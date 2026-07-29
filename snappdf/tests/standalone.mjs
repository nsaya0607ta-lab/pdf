/** 単一 HTML ファイル版の動作確認（file:// と http:// の両方） */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const htmlPath = join(root, 'snappdf.html');
const html = await readFile(htmlPath);

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
});
await new Promise((r) => server.listen(4180, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function run(label, url) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  try {
    await page.goto(url);
    await page.waitForSelector('.dropzone__title', { timeout: 20000 });
    await page.setInputFiles('input[accept="image/*"]:not([capture])', [
      join(root, 'tests/fixtures/doc-01.jpg'),
      join(root, 'tests/fixtures/doc-02.jpg'),
    ]);
    await page.waitForFunction(() => document.querySelectorAll('.card img').length === 2, null, { timeout: 60000 });
    await page.getByRole('button', { name: 'PDF を作成' }).click();
    await page.waitForSelector('.result-summary', { timeout: 120000 });
    const meta = (await page.locator('.result-summary__meta').innerText()).replace(/\s+/g, ' ');

    let saved = 'ダウンロード不可';
    try {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.getByRole('button', { name: '保存する' }).click(),
      ]);
      const path = join(root, 'tests/output', `standalone-${label}.pdf`);
      await dl.saveAs(path);
      const bytes = await readFile(path);
      const { PDFDocument } = await import('pdf-lib');
      saved = `${(await PDFDocument.load(bytes)).getPageCount()} ページ / ${(bytes.length / 1024).toFixed(0)}KB`;
    } catch {
      /* ダウンロードがブロックされる環境もある */
    }
    console.log(`OK  ${label}: ${meta} / 保存: ${saved}`);
    console.log(`    ワーカー: ${page.workers().length} 個 / エラー: ${errors.length ? errors.slice(0, 2).join(' | ') : 'なし'}`);
    await page.screenshot({ path: join(root, 'tests/output', `standalone-${label}.png`) });
  } catch (error) {
    console.log(`NG  ${label}: ${String(error).split('\n')[0]}`);
    console.log(`    エラー: ${errors.slice(0, 3).join(' | ')}`);
  }
  await ctx.close();
}

await run('http', 'http://localhost:4180/');
await run('file', `file://${htmlPath}`);

await browser.close();
server.close();
