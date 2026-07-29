/**
 * アプリアイコンを生成するスクリプト。
 *
 *   npm i -D sharp
 *   node scripts/generate-icons.mjs
 *
 * assets/app-icon-source.png（正方形の元絵）から、
 * PWA・iOS・favicon 用の各サイズを public/ へ書き出す。
 *
 * 生成済みの PNG はリポジトリに含まれているため、
 * アイコンを差し替えるときだけ実行すればよい。
 */

import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, 'assets/app-icon-source.png');
const publicDir = join(root, 'public');

/** 元絵の角丸カードの位置（余白と影を除いた範囲） */
const CROP = { left: 86, top: 72, width: 1082, height: 1082 };
/** 角丸の半径（辺の長さに対する比率） */
const CORNER_RATIO = 0.225;
/** 背景グラデーション（元絵のカード色に合わせる） */
const GRADIENT_TOP = '#F9725A';
const GRADIENT_BOTTOM = '#F94046';

const backgroundSvg = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="${GRADIENT_TOP}"/>
           <stop offset="1" stop-color="${GRADIENT_BOTTOM}"/>
         </linearGradient>
       </defs>
       <rect width="${size}" height="${size}" fill="url(#g)"/>
     </svg>`,
  );

const roundedMaskSvg = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${size * CORNER_RATIO}" ry="${size * CORNER_RATIO}" fill="#fff"/>
     </svg>`,
  );

/** 元絵を指定サイズへ切り出し、角を丸めた PNG バッファを返す */
async function artwork(size) {
  const cropped = await sharp(sourcePath)
    .extract(CROP)
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer();
  return sharp(cropped)
    .composite([{ input: roundedMaskSvg(size), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/**
 * 全面塗りのアイコン（角の外側も背景色で埋める）。
 * iOS / Android が独自のマスクをかけても白い角が出ない。
 */
async function fullBleedIcon(size) {
  const art = await artwork(size);
  return sharp(backgroundSvg(size)).composite([{ input: art }]).png().toBuffer();
}

/** maskable 用：安全領域を確保するため中央 78% に縮小して配置する */
async function maskableIcon(size) {
  const inner = Math.round(size * 0.78);
  const art = await artwork(inner);
  const offset = Math.round((size - inner) / 2);
  return sharp(backgroundSvg(size))
    .composite([{ input: art, top: offset, left: offset }])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const outputs = [
    ['icon-192.png', await fullBleedIcon(192)],
    ['icon-512.png', await fullBleedIcon(512)],
    ['apple-touch-icon.png', await fullBleedIcon(180)],
    ['favicon-64.png', await fullBleedIcon(64)],
    ['icon-maskable-512.png', await maskableIcon(512)],
  ];

  for (const [name, buffer] of outputs) {
    await writeFile(join(publicDir, name), buffer);
    console.log(`[generate-icons] ${name} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch((error) => {
  console.error('[generate-icons] 失敗:', error);
  process.exitCode = 1;
});
