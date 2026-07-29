/**
 * 単一 HTML ファイル版をビルドする。
 *
 *   node scripts/build-standalone.mjs   →  snappdf.html
 *
 * JS・CSS・Web Worker・pdf.js ワーカーをすべて 1 つの HTML に埋め込むため、
 * ファイルを配布するだけでどこでも動かせる（サーバー不要）。
 * Worker は Blob URL から生成する。
 */

import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const shared = {
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  write: false,
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env': JSON.stringify({ BASE_URL: './', MODE: 'standalone', PROD: 'true' }),
  },
};

// 1) 画像処理・PDF 生成ワーカー
const workerBuild = await build({
  ...shared,
  entryPoints: [join(root, 'src/workers/pipeline.worker.ts')],
  outfile: 'worker.js',
});
const workerCode = workerBuild.outputFiles[0].text;

// 2) アプリ本体（Service Worker 登録は単一ファイルでは無効化される）
const appBuild = await build({
  ...shared,
  entryPoints: [join(root, 'src/main.tsx')],
  outfile: 'app.js',
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
});
const appJs = appBuild.outputFiles.find((f) => f.path.endsWith('.js')).text;
const appCss = appBuild.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';

// 3) pdf.js のワーカー（ポリフィル付き）
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const pdfWorkerCode =
  `for(const C of [Map,WeakMap]){if(typeof C.prototype.getOrInsert!=="function"){C.prototype.getOrInsert=function(k,v){if(!this.has(k))this.set(k,v);return this.get(k)}}if(typeof C.prototype.getOrInsertComputed!=="function"){C.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k)}}}\n` +
  (await readFile(join(pdfjsRoot, 'build/pdf.worker.min.mjs'), 'utf8'));

// タブのファビコンは単一ファイルで完結させるためデータ URL で埋め込む。
// ホーム画面用アイコン（apple-touch-icon）とマニフェストは、
// 同じ場所に置かれていれば使われる（無くてもアプリは動作する）。
const faviconDataUrl = `data:image/png;base64,${(
  await readFile(join(root, 'public/favicon-64.png'))
).toString('base64')}`;

/** JS 文字列リテラルとして安全に埋め込む（</script と行区切り文字を無害化） */
const toScriptString = (code) =>
  JSON.stringify(code)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5" />
<title>SnapPDF - 画像をまとめてPDFに</title>
<meta name="description" content="複数の画像をかんたんに1つのPDFへまとめるアプリ" />
<meta name="theme-color" content="#ffffff" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="SnapPDF" />
<link rel="icon" type="image/png" href="${faviconDataUrl}" />
<link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />
<link rel="manifest" href="./manifest.webmanifest" />
<style>html{background:#f5f6f8}@media (prefers-color-scheme:dark){html{background:#0e1116}}</style>
<style>${appCss}</style>
</head>
<body>
<div id="root"></div>
<noscript>このアプリを使うには JavaScript を有効にしてください。</noscript>
<script>
// Worker のコードを Blob URL 化して埋め込む（単一ファイルで動かすため）
(function () {
  var mk = function (code, type) {
    try { return URL.createObjectURL(new Blob([code], { type: type })); } catch (e) { return undefined; }
  };
  window.__SNAPPDF_WORKER_URL__ = mk(${toScriptString(workerCode)}, 'text/javascript');
  window.__SNAPPDF_PDFJS_WORKER_URL__ = mk(${toScriptString(pdfWorkerCode)}, 'text/javascript');
})();
</script>
<script type="module">${appJs}</script>
</body>
</html>
`;

const outPath = join(root, 'snappdf.html');
await writeFile(outPath, html);
console.log(`${outPath} を出力しました（${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB）`);
