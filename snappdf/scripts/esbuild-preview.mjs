/**
 * Vite を使わずに動作確認用のバンドルを作るスクリプト（esbuild）。
 *
 * 通常の開発・本番ビルドは `npm run dev` / `npm run build`（Vite）を使ってください。
 * このスクリプトは Vite が導入できない環境での検証用フォールバックです。
 *
 *   node scripts/esbuild-preview.mjs   →  preview-dist/ に出力
 */

import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'preview-dist');

const shared = {
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env': JSON.stringify({ BASE_URL: './', MODE: 'preview', PROD: 'false' }),
    __PIPELINE_WORKER_URL__: '"./pipeline.worker.js"',
  },
  loader: { '.png': 'file', '.svg': 'file' },
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
  ...shared,
  entryPoints: [join(root, 'src/main.tsx')],
  outfile: join(outDir, 'app.js'),
  splitting: false,
});

await build({
  ...shared,
  entryPoints: [join(root, 'src/workers/pipeline.worker.ts')],
  outfile: join(outDir, 'pipeline.worker.js'),
});

await cp(join(root, 'public'), outDir, { recursive: true });

const html = await readFile(join(root, 'index.html'), 'utf8');
await writeFile(
  join(outDir, 'index.html'),
  html
    .replace('<script type="module" src="/src/main.tsx"></script>', '<script type="module" src="./app.js"></script>')
    .replace('</head>', '  <link rel="stylesheet" href="./app.css" />\n  </head>'),
);

console.log('preview-dist/ に出力しました');
