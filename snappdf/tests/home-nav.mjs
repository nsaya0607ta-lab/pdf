/** ホーム画面への戻り動作の確認 */

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
await new Promise((r) => server.listen(4182, r));
await mkdir(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  OK ' : '  NG '} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://localhost:4182/');
await page.waitForSelector('.dropzone__title');

/* 1. ホームでは戻る矢印を出さない */
check('ホームでは戻る矢印を表示しない', (await page.getByRole('button', { name: 'ホームに戻る' }).count()) === 0);

/* 2. 画像を取り込むとページ一覧になり、戻る矢印が出る */
await page.setInputFiles('input[accept="image/*"]:not([capture])', [fx('doc-01.jpg'), fx('doc-02.jpg')]);
await page.waitForFunction(() => document.querySelectorAll('.card img').length === 2, null, { timeout: 60000 });
const hasBack = await page.getByRole('button', { name: 'ホームに戻る' }).count();
check('ページ一覧に「ホームに戻る」矢印が出る', hasBack === 1);
await page.screenshot({ path: join(outDir, 'n1-pages.png') });

/* 3. 矢印でホームへ戻れる（ページは保持される） */
await page.getByRole('button', { name: 'ホームに戻る' }).click();
await page.waitForSelector('.dropzone__title');
const resumeText = await page.locator('.resume__title').innerText();
check('矢印でホームへ戻れる', resumeText.includes('2 枚'), resumeText);
check('ホームに戻ってもページは消えない', (await page.locator('.resume').count()) === 1);
check('ホームでは下部バーを隠す', (await page.locator('.footer').count()) === 0);
await page.screenshot({ path: join(outDir, 'n2-home.png') });

/* 4. 「続きから」でページ一覧へ戻れる */
await page.locator('.resume').click();
await page.waitForSelector('.card');
check('「続きから」でページ一覧へ戻れる', (await page.locator('.card').count()) === 2);

/* 5. 端末の戻る操作でもホームへ戻る */
await page.goBack();
await page.waitForTimeout(500);
const backToHome = await page.locator('.dropzone__title').count();
check('端末の戻る操作でもホームへ戻る', backToHome === 1);

/* 6. ホームから追加すると一覧へ戻り、枚数が増える */
await page.setInputFiles('input[accept="image/*"]:not([capture])', [fx('doc-03.jpg')]);
await page.waitForFunction(() => document.querySelectorAll('.card').length === 3, null, { timeout: 60000 });
check('ホームから追加すると一覧に戻り枚数が増える', (await page.locator('.card').count()) === 3);

/* 7. すべて削除するとホームへ戻る */
await page.getByRole('button', { name: 'ツール' }).click();
page.once('dialog', (d) => d.accept());
await page.getByRole('menuitem', { name: 'すべて削除' }).click();
await page.waitForSelector('.dropzone__title');
check('すべて削除するとホームへ戻る', (await page.locator('.resume').count()) === 0);

check('コンソールエラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 件成功`);
if (failed.length > 0) process.exitCode = 1;
