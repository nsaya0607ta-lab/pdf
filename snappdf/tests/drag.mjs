/** ドラッグ並び替えの動作確認 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'preview-dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = join(distDir, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || !existsSync(p)) p = join(distDir, 'index.html');
  try { res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(4178, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://localhost:4178/');
await page.setInputFiles('input[accept="image/*"]:not([capture])', [
  join(root, 'tests/fixtures/doc-01.jpg'),
  join(root, 'tests/fixtures/doc-02.jpg'),
  join(root, 'tests/fixtures/doc-03.jpg'),
]);
await page.waitForFunction(() => document.querySelectorAll('.card img').length === 3);
await page.waitForTimeout(500);

const names = () => page.$$eval('.card .card__name', (els) => els.map((e) => e.textContent));
console.log('before:', await names());

// 1 枚目のドラッグハンドルを掴んで 3 枚目の位置へ運ぶ
const handle = page.locator('.card__handle').first();
const handleBox = await handle.boundingBox();
const targetBox = await page.locator('.card').nth(2).boundingBox();
await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
await page.mouse.down();
await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
await page.waitForTimeout(200);
await page.mouse.up();
await page.waitForTimeout(400);

const after = await names();
console.log('after :', after);
console.log(after[2]?.includes('doc-01') ? 'OK  ドラッグで並び替えできる' : 'NG  並び替えできていない');
await page.screenshot({ path: join(root, 'tests/output/13-drag.png') });
await browser.close();
server.close();
