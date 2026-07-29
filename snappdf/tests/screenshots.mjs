/** README / 紹介用のスクリーンショットを撮影する */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'preview-dist');
const outDir = join(root, 'tests/shots');
const fx = (n) => join(root, 'tests/fixtures', n);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = join(distDir, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || !existsSync(p)) p = join(distDir, 'index.html');
  try { res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(4179, r));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
const clearToasts = () => page.waitForFunction(() => document.querySelectorAll('.toast').length === 0, null, { timeout: 15000 }).catch(() => {});

await page.goto('http://localhost:4179/');
await page.waitForSelector('.dropzone__title');
await page.screenshot({ path: join(outDir, 'a-取り込み画面.png') });

await page.setInputFiles('input[accept="image/*"]:not([capture])', [fx('doc-01.jpg'), fx('doc-02.jpg'), fx('doc-03.jpg')]);
await page.waitForFunction(() => document.querySelectorAll('.card img').length === 3, null, { timeout: 60000 });
await clearToasts();
await page.screenshot({ path: join(outDir, 'b-ページ一覧.png') });

await page.locator('.card').first().getByRole('button', { name: '編集' }).click();
await page.waitForSelector('.editor__canvas img');
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, 'c-編集.png') });
await page.getByRole('button', { name: 'トリミング' }).click();
await page.waitForSelector('.crop-mask');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, 'd-トリミング.png') });
await page.getByRole('button', { name: 'キャンセル' }).click();
await page.getByRole('button', { name: '完了' }).click();

await page.locator('.footer').getByRole('button', { name: '設定' }).click();
await page.waitForSelector('.sheet');
await clearToasts();
await page.screenshot({ path: join(outDir, 'e-PDF設定.png') });
await page.getByRole('button', { name: '完了' }).click();

await page.getByRole('button', { name: 'PDF を作成' }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: join(outDir, 'f-進捗.png') }).catch(() => {});
await page.waitForSelector('.result-summary', { timeout: 120000 });
await clearToasts();
await page.screenshot({ path: join(outDir, 'g-完成.png') });

await page.getByRole('button', { name: '戻る', exact: true }).first().click();
await page.getByRole('button', { name: 'ダークモードに切り替え' }).click();
await page.waitForTimeout(600);
await clearToasts();
await page.screenshot({ path: join(outDir, 'h-ダークモード.png') });

await page.setViewportSize({ width: 1280, height: 820 });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'ライトモードに切り替え' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: join(outDir, 'i-デスクトップ.png') });

await browser.close();
server.close();
console.log('スクリーンショットを tests/shots/ に保存しました');
