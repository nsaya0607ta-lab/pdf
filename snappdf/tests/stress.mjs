/**
 * 負荷テスト：2400×3200 の画像 100 枚を取り込み、PDF を生成できるか確認する。
 *   node tests/stress.mjs
 * 取り込み時間・生成時間・JS ヒープ使用量を計測する。
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'preview-dist');
const outDir = join(root, 'tests/output');
const bulkDir = join(root, 'tests/fixtures/bulk');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = join(distDir, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || !existsSync(p)) p = join(distDir, 'index.html');
  try {
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' }).end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(4176, r));
await mkdir(outDir, { recursive: true });

const files = (await readdir(bulkDir)).filter((f) => f.endsWith('.jpg')).map((f) => join(bulkDir, f));
console.log(`テスト画像: ${files.length} 枚`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 430, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:4176/');

const heap = async () =>
  (await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 1024 / 1024;

const t0 = Date.now();
await page.setInputFiles('input[accept="image/*"]:not([capture])', files);
await page.waitForFunction(() => document.querySelectorAll('.card').length === 100, null, {
  timeout: 300000,
});
const importMs = Date.now() - t0;
console.log(`取り込み: ${(importMs / 1000).toFixed(1)} 秒 / ヒープ ${(await heap()).toFixed(0)} MB`);

// 画面に見えている分だけサムネイルが生成されていること（Lazy Load の確認）
const renderedAtTop = await page.evaluate(() => document.querySelectorAll('.card img').length);
console.log(`初期表示時点のサムネイル生成数: ${renderedAtTop} / 100（Lazy Load）`);

// 一番下までスクロールしても落ちないこと
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(4000);
console.log(`スクロール後ヒープ: ${(await heap()).toFixed(0)} MB`);

// UI が固まっていないか（応答時間を計測）
await page.evaluate(() => window.scrollTo(0, 0));
const t1 = Date.now();
await page.getByRole('button', { name: 'PDF を作成' }).click();
await page.waitForSelector('.progress-overlay', { timeout: 20000 });
const firstPaint = Date.now() - t1;

// 生成中に UI が反応するか（進捗テキストが更新され続けるか）
const samples = [];
for (let i = 0; i < 6; i += 1) {
  await page.waitForTimeout(2500);
  const detail = await page.locator('.progress-card__detail').innerText().catch(() => '');
  if (detail) samples.push(detail.trim());
  if (!(await page.locator('.progress-overlay').count())) break;
}
console.log(`進捗表示のサンプル: ${samples.join(' → ')}`);

await page.waitForSelector('.result-summary', { timeout: 900000 });
const buildMs = Date.now() - t1;
const summary = (await page.locator('.result-summary__meta').innerText()).replace(/\s+/g, ' ');
console.log(`PDF 生成: ${(buildMs / 1000).toFixed(1)} 秒（進捗表示まで ${firstPaint} ms）`);
console.log(`結果: ${summary} / ヒープ ${(await heap()).toFixed(0)} MB`);

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 60000 }),
  page.getByRole('button', { name: '保存する' }).click(),
]);
const pdfPath = join(outDir, 'stress-100.pdf');
await download.saveAs(pdfPath);
const bytes = await readFile(pdfPath);
const { PDFDocument } = await import('pdf-lib');
const doc = await PDFDocument.load(bytes);
console.log(`保存された PDF: ${doc.getPageCount()} ページ / ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`エラー: ${errors.length === 0 ? 'なし' : errors.slice(0, 3).join(' | ')}`);

await page.screenshot({ path: join(outDir, '12-stress.png') });
await browser.close();
server.close();

if (doc.getPageCount() !== 100 || errors.length > 0) process.exitCode = 1;
