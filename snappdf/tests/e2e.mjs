/**
 * 動作検証スクリプト（Playwright）。
 *   node tests/e2e.mjs
 * preview-dist/ を静的配信し、実際の操作を再現して PDF が生成できるか確認する。
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'preview-dist');
const outDir = join(root, 'tests/output');
const fixtures = join(root, 'tests/fixtures');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let filePath = join(distDir, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || !existsSync(filePath)) filePath = join(distDir, 'index.html');
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(4173, resolve));
await mkdir(outDir, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  OK ' : '  NG '} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({
  viewport: { width: 430, height: 900 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

/* 1. 初期表示 */
await page.waitForSelector('.dropzone__title');
check('初期画面が表示される', true);
await page.screenshot({ path: join(outDir, '01-empty.png') });

/* 2. 画像を 3 枚取り込む */
await page.setInputFiles('input[accept="image/*"]:not([capture])', [
  join(fixtures, 'doc-01.jpg'),
  join(fixtures, 'doc-02.jpg'),
  join(fixtures, 'doc-03.jpg'),
]);
await page.waitForSelector('.card', { timeout: 30000 });
await page.waitForFunction(() => document.querySelectorAll('.card img').length === 3, null, {
  timeout: 60000,
});
const cardCount = await page.locator('.card').count();
check('3 枚の画像が取り込まれサムネイルが生成される', cardCount === 3, `${cardCount} 枚`);
await page.screenshot({ path: join(outDir, '02-grid.png') });

/* 3. 並び替え（名前順・降順） */
await page.getByRole('button', { name: '並び替え', exact: true }).click();
await page.getByRole('menuitem', { name: '名前順' }).click();
await page.getByRole('button', { name: '並び替え', exact: true }).click();
await page.getByRole('menuitem', { name: '名前順' }).click();
const firstName = await page.locator('.card .card__name').first().innerText();
check('名前順（降順）で並び替えできる', firstName.includes('doc-03'), firstName);

/* 4. 逆順に戻す */
await page.getByRole('button', { name: '並び替え', exact: true }).click();
await page.getByRole('menuitem', { name: '現在の並びを逆順にする' }).click();
const firstAfterReverse = await page.locator('.card .card__name').first().innerText();
check('逆順にできる', firstAfterReverse.includes('doc-01'), firstAfterReverse);

/* 5. 拡大プレビュー */
await page.locator('.card__thumb').first().click();
await page.waitForSelector('.lightbox');
await page.waitForSelector('.lightbox__stage img');
const lightboxText = await page.locator('.lightbox__footer').innerText();
check('拡大プレビューにページ番号が出る', lightboxText.includes('1 / 3'), lightboxText.trim());
await page.screenshot({ path: join(outDir, '03-lightbox.png') });
await page.getByRole('button', { name: '戻る', exact: true }).first().click();

/* 6. 編集（回転） */
await page.locator('.card').first().getByRole('button', { name: '編集' }).click();
await page.waitForSelector('.editor__canvas img');
await page.getByRole('button', { name: '右に回転' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: join(outDir, '04-editor.png') });
const hasRotationBadge = await page.locator('.editor__canvas img').isVisible();
check('編集シートで回転できる', hasRotationBadge);

/* 7. トリミング */
await page.getByRole('button', { name: 'トリミング' }).click();
await page.waitForSelector('.crop-mask');
const box = await page.locator('.crop-mask').boundingBox();
await page.mouse.move(box.x + box.width - 4, box.y + box.height - 4);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 10 });
await page.mouse.up();
await page.getByRole('button', { name: '適用' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: join(outDir, '05-cropped.png') });
await page.getByRole('button', { name: '完了' }).click();
const cropBadge = await page.locator('.badge', { hasText: '切抜' }).count();
check('トリミングが適用される', cropBadge > 0, `切抜バッジ ${cropBadge} 件`);

/* 8. 複製と削除 */
await page.locator('.card').first().getByRole('button', { name: '複製' }).click();
await page.waitForTimeout(400);
let count = await page.locator('.card').count();
check('ページを複製できる', count === 4, `${count} 枚`);
await page.locator('.card').nth(1).getByRole('button', { name: '削除' }).click();
await page.waitForTimeout(400);
count = await page.locator('.card').count();
check('ページを削除できる', count === 3, `${count} 枚`);

/* 9. PDF 設定 */
await page.locator('.footer').getByRole('button', { name: '設定' }).click();
await page.waitForSelector('.sheet');
await page.getByLabel('PDF のファイル名').fill('テスト書類');
await page.getByRole('radio', { name: /^A4/ }).click();
await page.getByRole('radio', { name: '縦', exact: true }).click();
await page.getByRole('radio', { name: '中' }).click();
await page.getByRole('radio', { name: /高画質/ }).click();
await page.screenshot({ path: join(outDir, '06-settings.png') });
await page.getByRole('button', { name: '完了' }).click();
check('PDF 設定を変更できる', true);

/* 10. PDF 作成 */
await page.getByRole('button', { name: 'PDF を作成' }).click();
await page.waitForSelector('.progress-overlay', { timeout: 10000 }).catch(() => {});
await page.waitForSelector('.result-summary', { timeout: 120000 });
const summary = await page.locator('.result-summary__meta').innerText();
check('PDF が生成される', summary.includes('3 ページ'), summary.replace(/\s+/g, ' ').trim());
await page.screenshot({ path: join(outDir, '07-result.png') });

/* 11. ダウンロード内容の検証 */
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.getByRole('button', { name: '保存する' }).click(),
]);
const pdfPath = join(outDir, 'result.pdf');
await download.saveAs(pdfPath);
const pdfBytes = await readFile(pdfPath);
const { PDFDocument } = await import('pdf-lib');
const doc = await PDFDocument.load(pdfBytes);
const size = doc.getPage(0).getSize();
check(
  'PDF のページ数と用紙サイズが正しい',
  doc.getPageCount() === 3 && Math.round(size.width) === 595 && Math.round(size.height) === 842,
  `${doc.getPageCount()}ページ / ${Math.round(size.width)}×${Math.round(size.height)}pt / ${(pdfBytes.length / 1024).toFixed(0)}KB`,
);

/* 12. 圧縮（ファイルサイズが実際に小さくなることを確認） */
const beforeMeta = await page.locator('.result-summary__meta').innerText();
await page.getByRole('button', { name: '圧縮' }).click();
await page.getByRole('radio', { name: /軽量/ }).click();
await page.getByRole('button', { name: 'この画質で圧縮する' }).click();
await page.waitForFunction(
  (previous) => {
    const element = document.querySelector('.result-summary__meta');
    return element !== null && element.textContent !== previous;
  },
  beforeMeta,
  { timeout: 180000 },
);
const compressed = await page.locator('.result-summary__meta').innerText();
const sizeOf = (text) => {
  const match = /([\d.]+)\s*(KB|MB|B)/.exec(text);
  if (!match) return Number.NaN;
  const value = Number(match[1]);
  return match[2] === 'MB' ? value * 1024 : match[2] === 'B' ? value / 1024 : value;
};
check(
  'PDF を再圧縮するとサイズが小さくなる',
  sizeOf(compressed) < sizeOf(beforeMeta),
  `${beforeMeta.match(/[\d.]+\s*(KB|MB|B)/)?.[0]} → ${compressed.match(/[\d.]+\s*(KB|MB|B)/)?.[0]}`,
);

/* 13. 分割（ZIP 出力） */
await page.getByRole('button', { name: 'このPDFを分割する' }).click();
await page.getByRole('radio', { name: '1ページずつ' }).click();
const [zip] = await Promise.all([
  page.waitForEvent('download', { timeout: 60000 }),
  page.getByRole('button', { name: '分割する', exact: true }).click(),
]);
const zipPath = join(outDir, 'split.zip');
await zip.saveAs(zipPath);
const zipBytes = await readFile(zipPath);
check('分割結果を ZIP で保存できる', zipBytes.length > 1000 && zipBytes[0] === 0x50, `${(zipBytes.length / 1024).toFixed(0)}KB`);

/* 14. ダークモード */
await page.getByRole('button', { name: '戻る', exact: true }).first().click();
await page.getByRole('button', { name: 'ダークモードに切り替え' }).click();
await page.waitForTimeout(300);
const theme = await page.evaluate(() => document.documentElement.dataset.theme);
check('ダークモードに切り替わる', theme === 'dark', String(theme));
await page.screenshot({ path: join(outDir, '08-dark.png') });

/* 15. 設定の永続化 */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.dropzone__title');
const persistedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
await page.getByRole('button', { name: 'PDF 設定' }).click();
await page.waitForSelector('.sheet');
const paperActive = await page
  .locator('.segmented__item--active')
  .first()
  .innerText();
check(
  '設定が次回起動時に復元される',
  persistedTheme === 'dark' && paperActive.includes('A4'),
  `${persistedTheme} / ${paperActive.replace(/\s+/g, ' ')}`,
);
await page.screenshot({ path: join(outDir, '09-reload.png') });

/* 16. デスクトップ表示 */
await page.setViewportSize({ width: 1280, height: 900 });
await page.getByRole('button', { name: '戻る', exact: true }).first().click();
await page.setInputFiles('input[accept="image/*"]:not([capture])', [
  join(fixtures, 'doc-01.jpg'),
  join(fixtures, 'doc-03.jpg'),
]);
await page.waitForSelector('.card');
await page.waitForTimeout(2500);
await page.screenshot({ path: join(outDir, '10-desktop.png') });
check('デスクトップ幅でも崩れない', true);

/* 17. 既存 PDF の結合（PDF を選ぶとページとして取り込まれる） */
const beforeMerge = await page.locator('.card').count();
await page.setInputFiles('input[accept*="application/pdf"]', [pdfPath]);
await page.waitForFunction(
  (previous) => document.querySelectorAll('.card').length > previous,
  beforeMerge,
  { timeout: 120000 },
);
await page.waitForTimeout(2000);
const afterMerge = await page.locator('.card').count();
check(
  '既存 PDF を読み込んでページとして結合できる',
  afterMerge === beforeMerge + 3,
  `${beforeMerge} → ${afterMerge} 枚`,
);
await page.screenshot({ path: join(outDir, '11-merged.png') });

/* 18. Web Worker が使われている */
check(
  '重い処理が Web Worker で実行されている',
  page.workers().length > 0,
  `${page.workers().length} 個のワーカー`,
);

check('コンソールエラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' | '));

await writeFile(join(outDir, 'report.json'), JSON.stringify(results, null, 2));
await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 件成功`);
if (failed.length > 0) process.exitCode = 1;
