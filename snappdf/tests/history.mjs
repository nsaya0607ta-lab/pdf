/** 追加機能（戻るボタン・PDF履歴）の動作確認 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'preview-dist');
const outDir = join(root, 'tests/output');
const fx = (n) => join(root, 'tests/fixtures', n);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = join(distDir, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || !existsSync(p)) p = join(distDir, 'index.html');
  try { res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(4181, r));
await mkdir(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  OK ' : '  NG '} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://localhost:4181/');
await page.waitForSelector('.dropzone__title');

/* --- 1. PDF を作成して履歴に入ることを確認 --- */
await page.setInputFiles('input[accept="image/*"]:not([capture])', [fx('doc-01.jpg'), fx('doc-02.jpg')]);
await page.waitForFunction(() => document.querySelectorAll('.card img').length === 2, null, { timeout: 60000 });
await page.getByRole('button', { name: 'PDF を作成' }).click();
await page.waitForSelector('.result-summary', { timeout: 120000 });

const savedNotice = await page.locator('.notice', { hasText: '履歴に保存されました' }).count();
check('作成直後に「履歴に保存されました」と案内される', savedNotice > 0);
await page.screenshot({ path: join(outDir, 'h1-result.png') });

/* --- 2. シートに戻るボタンがある --- */
const backButtons = await page.getByRole('button', { name: '戻る' }).count();
check('シートに「戻る」ボタンがある', backButtons > 0, `${backButtons} 個`);

/* --- 3. 端末の戻る操作でシートが閉じる（アプリからは離脱しない） --- */
await page.goBack();
await page.waitForTimeout(500);
const sheetGone = (await page.locator('.sheet').count()) === 0;
const stillInApp = (await page.locator('.card').count()) === 2;
check('端末の戻る操作でシートが閉じる', sheetGone && stillInApp, `シート${sheetGone ? '閉' : '開'} / カード${await page.locator('.card').count()}枚`);

/* --- 4. 履歴画面を開く --- */
await page.getByRole('button', { name: '作成したPDFの履歴' }).click();
await page.waitForSelector('.history-item');
const itemCount = await page.locator('.history-item').count();
const itemName = await page.locator('.history-item__name').first().innerText();
const itemMeta = await page.locator('.history-item__meta').first().innerText();
check('履歴にPDFが表示される', itemCount === 1 && itemMeta.includes('2 ページ'), `${itemCount}件 / ${itemName} / ${itemMeta.replace(/\s+/g, ' ')}`);

const hasThumb = await page.locator('.history-item__thumb img').count();
check('履歴にサムネイルが表示される', hasThumb === 1);
await page.screenshot({ path: join(outDir, 'h2-history.png') });

/* --- 5. 履歴から保存できる --- */
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.locator('.history-item').first().getByRole('button', { name: '保存' }).click(),
]);
const pdfPath = join(outDir, 'history.pdf');
await download.saveAs(pdfPath);
const bytes = await readFile(pdfPath);
const { PDFDocument } = await import('pdf-lib');
const doc = await PDFDocument.load(bytes);
check('履歴から保存したPDFが正しい', doc.getPageCount() === 2, `${doc.getPageCount()}ページ / ${(bytes.length / 1024).toFixed(0)}KB`);

/* --- 6. リロードしても履歴が残る（IndexedDB） --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.dropzone__title');
await page.waitForSelector('.recent__item', { timeout: 20000 });
const recentName = await page.locator('.recent__name').first().innerText();
check('リロード後も履歴が残り、取り込み画面に表示される', recentName.length > 0, recentName);
await page.screenshot({ path: join(outDir, 'h3-recent.png') });

/* --- 7. 履歴のPDFを読み込んで編集できる --- */
await page.locator('.recent__item').first().click();
await page.waitForSelector('.history-item');
await page.locator('.history-item').first().getByRole('button', { name: '編集' }).click();
await page.waitForFunction(() => document.querySelectorAll('.card').length === 2, null, { timeout: 120000 });
check('履歴のPDFをページとして読み込める', (await page.locator('.card').count()) === 2);

/* --- 8. 履歴から削除できる --- */
await page.getByRole('button', { name: '作成したPDFの履歴' }).click();
await page.waitForSelector('.history-item');
page.once('dialog', (d) => d.accept());
await page.locator('.history-item').first().getByRole('button', { name: /履歴から削除/ }).click();
await page.waitForTimeout(700);
const afterDelete = await page.locator('.history-item').count();
check('履歴から削除できる', afterDelete === 0, `${afterDelete}件`);

/* --- 9. 履歴オフの設定が残る --- */
await page.getByRole('switch', { name: '作成したPDFを端末に保存する' }).click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.dropzone__title');
await page.getByRole('button', { name: '作成したPDFの履歴' }).click();
await page.waitForSelector('.sheet');
const switchState = await page.getByRole('switch', { name: '作成したPDFを端末に保存する' }).getAttribute('aria-checked');
check('履歴のオン/オフ設定が保存される', switchState === 'false', String(switchState));

/* --- 10. 戻るボタンで履歴画面を閉じられる --- */
await page.getByRole('button', { name: '戻る' }).click();
await page.waitForTimeout(400);
check('戻るボタンでシートを閉じられる', (await page.locator('.sheet').count()) === 0);

check('コンソールエラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 件成功`);
if (failed.length > 0) process.exitCode = 1;
