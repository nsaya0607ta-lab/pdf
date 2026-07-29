/**
 * 画像処理パイプライン（メインスレッド / Web Worker 共用）。
 *
 * 元画像 Blob → EXIF 向き補正 → トリミング → 回転 → 縮小 → 自動補正 → 再エンコード
 * という流れを 1 本の関数にまとめている。
 * 常に元 Blob から作り直すため、編集操作は完全に非破壊で、劣化が蓄積しない。
 */

import type { CropRect, EnhanceOptions, RenderSpec, Rotation } from '../types';
import { applyAutoLevels, applyMonochrome, estimateSkewAngle, hasAnyEnhancement } from './enhance';
import { clamp } from './util';

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** OffscreenCanvas が使えるか（Worker 実行の可否判定にも使う） */
export function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

/** 実行環境に応じた canvas を作る */
export function createCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function get2dContext(canvas: AnyCanvas, alpha = false): Ctx2D {
  const ctx = canvas.getContext('2d', { alpha, willReadFrequently: false }) as Ctx2D | null;
  if (!ctx) throw new Error('Canvas 2D コンテキストを取得できませんでした');
  return ctx;
}

/** canvas を Blob 化する（OffscreenCanvas / HTMLCanvasElement 両対応） */
export async function canvasToBlob(
  canvas: AnyCanvas,
  type: string,
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画像の書き出しに失敗しました'))),
      type,
      quality,
    );
  });
}

/**
 * Blob を ImageBitmap にデコードする。
 * imageOrientation: 'from-image' により EXIF の向きはデコード時に解決される。
 */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // 古いブラウザ向けフォールバック（オプション未対応）
    return createImageBitmap(blob);
  }
}

/** 画像の実寸だけを取得する（取り込み時のメタ情報用） */
export async function measureImage(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await decodeImage(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * 「回転後の見た目」を基準に指定されたトリミング領域を、元画像の座標系へ変換する。
 * 90 度単位の回転では軸平行の矩形は軸平行のまま写るため、解析的に変換できる。
 * これにより、ユーザーは常に画面で見えているとおりの範囲を指定できる。
 */
export function cropToSourceSpace(crop: CropRect | undefined, rotation: Rotation): CropRect | undefined {
  if (!crop) return undefined;
  const { x: u0, y: v0, width: uw, height: vh } = crop;
  const u1 = u0 + uw;
  const v1 = v0 + vh;
  switch (rotation) {
    case 90:
      return { x: v0, y: 1 - u1, width: vh, height: uw };
    case 180:
      return { x: 1 - u1, y: 1 - v1, width: uw, height: vh };
    case 270:
      return { x: 1 - v1, y: u0, width: vh, height: uw };
    default:
      return crop;
  }
}

/** トリミング領域を実ピクセルへ変換する */
function resolveCrop(
  crop: CropRect | undefined,
  width: number,
  height: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!crop) return { sx: 0, sy: 0, sw: width, sh: height };
  const sx = clamp(Math.round(crop.x * width), 0, width - 1);
  const sy = clamp(Math.round(crop.y * height), 0, height - 1);
  const sw = clamp(Math.round(crop.width * width), 1, width - sx);
  const sh = clamp(Math.round(crop.height * height), 1, height - sy);
  return { sx, sy, sw, sh };
}

/** 回転後の出力サイズ */
function rotatedSize(width: number, height: number, rotation: Rotation) {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

/** 傾き補正：canvas の内容を -angle だけ回転して描き直す（背景は白で埋める） */
function deskewCanvas(source: AnyCanvas, angleDeg: number): AnyCanvas {
  const target = createCanvas(source.width, source.height);
  const ctx = get2dContext(target);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.translate(target.width / 2, target.height / 2);
  ctx.rotate((-angleDeg * Math.PI) / 180);
  ctx.drawImage(source as CanvasImageSource, -source.width / 2, -source.height / 2);
  return target;
}

export interface RenderedImage {
  blob: Blob;
  width: number;
  height: number;
  /** PDF 埋め込み時に必要な形式判定 */
  format: 'jpeg' | 'png';
}

/**
 * 1 ページ分の画像を最終的な出力用ビットマップへ変換する。
 * メモリを抑えるため、ImageBitmap は使い終わり次第 close() する。
 */
export async function renderImage(spec: RenderSpec): Promise<RenderedImage> {
  const bitmap = await decodeImage(spec.blob);
  let canvas: AnyCanvas;

  try {
    const sourceCrop = cropToSourceSpace(spec.crop, spec.rotation);
    const { sx, sy, sw, sh } = resolveCrop(sourceCrop, bitmap.width, bitmap.height);
    const rotated = rotatedSize(sw, sh, spec.rotation);

    // 長辺が maxEdge を超えないように縮小（拡大はしない）
    const scale = Math.min(1, spec.maxEdge / Math.max(rotated.width, rotated.height));
    const outWidth = Math.max(1, Math.round(rotated.width * scale));
    const outHeight = Math.max(1, Math.round(rotated.height * scale));

    canvas = createCanvas(outWidth, outHeight);
    const ctx = get2dContext(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    ctx.translate(outWidth / 2, outHeight / 2);
    ctx.rotate((spec.rotation * Math.PI) / 180);
    const drawWidth = spec.rotation === 90 || spec.rotation === 270 ? outHeight : outWidth;
    const drawHeight = spec.rotation === 90 || spec.rotation === 270 ? outWidth : outHeight;
    ctx.drawImage(bitmap, sx, sy, sw, sh, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  } finally {
    bitmap.close();
  }

  const enhance = spec.enhance;
  if (hasAnyEnhancement(enhance)) {
    canvas = applyEnhancements(canvas, enhance);
  }

  const usePng = enhance.monochrome;
  const blob = await canvasToBlob(
    canvas,
    usePng ? 'image/png' : 'image/jpeg',
    usePng ? undefined : spec.jpegQuality,
  );

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    format: usePng ? 'png' : 'jpeg',
  };
}

/** 自動補正をまとめて適用する */
function applyEnhancements(canvas: AnyCanvas, options: EnhanceOptions): AnyCanvas {
  let working = canvas;
  let ctx = get2dContext(working);
  let imageData = ctx.getImageData(0, 0, working.width, working.height);

  if (options.deskew) {
    const angle = estimateSkewAngle(imageData);
    if (angle !== 0) {
      working = deskewCanvas(working, angle);
      ctx = get2dContext(working);
      imageData = ctx.getImageData(0, 0, working.width, working.height);
    }
  }

  if (options.brightness || options.contrast) {
    applyAutoLevels(imageData, { brightness: options.brightness, contrast: options.contrast });
  }
  if (options.monochrome) {
    applyMonochrome(imageData);
  }
  ctx.putImageData(imageData, 0, 0);
  return working;
}
