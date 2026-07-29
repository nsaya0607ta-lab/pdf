/**
 * 画像の自動補正アルゴリズム群。
 *
 * すべて ImageData（RGBA）に対する純粋な処理として実装しているため、
 * メインスレッド／Web Worker のどちらからでも利用できる。
 * 外部ライブラリには依存しない。
 */

import type { EnhanceOptions } from '../types';
import { clamp } from './util';

/** RGB → 輝度（ITU-R BT.601） */
function luma(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** グレースケール配列を作る（縮小サンプリング対応） */
export function toGrayscale(image: ImageData, step = 1): Uint8Array {
  const { data, width, height } = image;
  const outWidth = Math.ceil(width / step);
  const outHeight = Math.ceil(height / step);
  const gray = new Uint8Array(outWidth * outHeight);
  let index = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const p = (y * width + x) * 4;
      gray[index] = luma(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0);
      index += 1;
    }
  }
  return gray;
}

/**
 * ヒストグラムの分位点を求める。
 * @returns [low, high] 累積比率が lowRatio / highRatio に達する輝度値
 */
function percentiles(gray: Uint8Array, lowRatio: number, highRatio: number): [number, number] {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i += 1) {
    const value = gray[i] ?? 0;
    histogram[value] = (histogram[value] ?? 0) + 1;
  }
  const total = gray.length;
  let acc = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v += 1) {
    acc += histogram[v] as number;
    if (acc >= total * lowRatio) {
      low = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) {
    acc += histogram[v] as number;
    if (acc >= total * (1 - highRatio)) {
      high = v;
      break;
    }
  }
  return [low, high];
}

/**
 * 明るさ・コントラストの自動補正。
 * - contrast: 下位 0.5% / 上位 0.5% の輝度を 0〜255 へ引き伸ばす（ヒストグラムストレッチ）
 * - brightness: 紙の白（上位 5% 付近）が白く見えるようにゲインを掛ける
 */
export function applyAutoLevels(
  image: ImageData,
  options: { brightness: boolean; contrast: boolean },
): void {
  if (!options.brightness && !options.contrast) return;

  const step = Math.max(1, Math.round(Math.sqrt((image.width * image.height) / 250_000)));
  const gray = toGrayscale(image, step);
  if (gray.length === 0) return;

  let inLow = 0;
  let inHigh = 255;
  if (options.contrast) {
    const [low, high] = percentiles(gray, 0.005, 0.995);
    if (high - low > 24) {
      inLow = low;
      inHigh = high;
    }
  }
  if (options.brightness) {
    const [, white] = percentiles(gray, 0.005, 0.95);
    // 白飛びしすぎない範囲で紙面を明るくする
    if (white > 40) inHigh = Math.min(inHigh, Math.max(white, inLow + 24));
  }
  if (inLow === 0 && inHigh === 255) return;

  // ルックアップテーブルを作って一括変換（ピクセルごとの除算を避ける）
  const lut = new Uint8ClampedArray(256);
  const scale = 255 / Math.max(1, inHigh - inLow);
  for (let v = 0; v < 256; v += 1) {
    lut[v] = clamp((v - inLow) * scale, 0, 255);
  }
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i] as number] as number;
    data[i + 1] = lut[data[i + 1] as number] as number;
    data[i + 2] = lut[data[i + 2] as number] as number;
  }
}

/**
 * 白黒スキャン化（適応的二値化）。
 * 積分画像を用いた局所平均法（Bradley & Roth）。
 * 影やムラのある写真でも文字がつぶれにくい。
 */
export function applyMonochrome(image: ImageData): void {
  const { data, width, height } = image;
  const size = width * height;
  if (size === 0) return;

  const gray = new Uint8Array(size);
  for (let i = 0, p = 0; i < size; i += 1, p += 4) {
    gray[i] = luma(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0);
  }

  // 積分画像（Float64 だとメモリを食うので Uint32 で十分）
  const integral = new Uint32Array(size);
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      rowSum += gray[i] as number;
      integral[i] = rowSum + (y > 0 ? (integral[i - width] as number) : 0);
    }
  }

  const radius = Math.max(8, Math.round(Math.min(width, height) / 40));
  const threshold = 0.86; // 局所平均の何割を下回ったら黒とみなすか

  for (let y = 0; y < height; y += 1) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const a = x1 > 0 && y1 > 0 ? (integral[(y1 - 1) * width + (x1 - 1)] as number) : 0;
      const b = y1 > 0 ? (integral[(y1 - 1) * width + x2] as number) : 0;
      const c = x1 > 0 ? (integral[y2 * width + (x1 - 1)] as number) : 0;
      const d = integral[y2 * width + x2] as number;
      const mean = (d - b - c + a) / count;
      const i = y * width + x;
      const value = (gray[i] as number) < mean * threshold ? 0 : 255;
      const p = i * 4;
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
    }
  }
}

/**
 * 傾き角の推定（射影プロファイル法）。
 * 縮小したグレースケール画像を候補角度で回転させ、
 * 行方向の輝度和の分散が最大になる角度＝文字行が水平に揃う角度とみなす。
 *
 * @returns 度数法の角度（正なら時計回りに傾いている）。補正不要なら 0。
 */
export function estimateSkewAngle(image: ImageData): number {
  const targetWidth = 480;
  const step = Math.max(1, Math.round(image.width / targetWidth));
  const width = Math.ceil(image.width / step);
  const height = Math.ceil(image.height / step);
  if (width < 40 || height < 40) return 0;

  const gray = toGrayscale(image, step);

  // 輝度の勾配（エッジ）を使う。文字行のある領域だけが強く反応する
  const edge = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const dy = Math.abs((gray[i + width] as number) - (gray[i - width] as number));
      edge[i] = dy;
    }
  }

  const maxAngle = 8;
  const coarseStep = 1;
  let best = 0;
  let bestScore = -1;
  /** 角度 0 のときのスコア。改善が小さいときは補正しない判断に使う */
  let baseScore = 0;

  const score = (angle: number): number => {
    const rad = (angle * Math.PI) / 180;
    const tan = Math.tan(rad);
    const profile = new Float32Array(height);
    for (let y = 0; y < height; y += 1) {
      let sum = 0;
      for (let x = 0; x < width; x += 4) {
        const shifted = Math.round(y + (x - width / 2) * tan);
        if (shifted < 0 || shifted >= height) continue;
        sum += edge[shifted * width + x] as number;
      }
      profile[y] = sum;
    }
    // 分散が大きいほど「行が揃っている」
    let mean = 0;
    for (let y = 0; y < height; y += 1) mean += profile[y] as number;
    mean /= height;
    let variance = 0;
    for (let y = 0; y < height; y += 1) {
      const diff = (profile[y] as number) - mean;
      variance += diff * diff;
    }
    return variance / height;
  };

  for (let angle = -maxAngle; angle <= maxAngle; angle += coarseStep) {
    const s = score(angle);
    if (angle === 0) baseScore = s;
    if (s > bestScore) {
      bestScore = s;
      best = angle;
    }
  }
  // 粗探索の周辺を 0.2 度刻みで詰める
  for (let angle = best - 1; angle <= best + 1; angle += 0.2) {
    const s = score(angle);
    if (s > bestScore) {
      bestScore = s;
      best = angle;
    }
  }

  // ごく小さい傾きは補正しない（再サンプリングによる劣化を避ける）
  if (Math.abs(best) < 0.3) return 0;
  // 文字行がはっきりしない写真などでは誤検出しやすいため、
  // 「傾けたほうが明らかに行が揃う」場合だけ補正を適用する
  if (baseScore > 0 && bestScore < baseScore * 1.25) return 0;
  return Number(best.toFixed(2));
}

/** 補正が 1 つでも有効かどうか */
export function hasAnyEnhancement(options: EnhanceOptions): boolean {
  return options.deskew || options.brightness || options.contrast || options.monochrome;
}
