/** 用紙サイズ・余白の計算ロジック */

import { MARGINS, MM_TO_PT, PAPER_SIZES } from '../../constants';
import type { MarginId, Orientation, PaperSizeId } from '../../types';

/** PDF 仕様上の 1 ページ最大サイズ（pt） */
const MAX_PAGE_PT = 14400;
/** 「元画像サイズ」で px → pt 変換する際に仮定する解像度 */
const ASSUMED_DPI = 96;

export function marginToPt(margin: MarginId): number {
  const found = MARGINS.find((m) => m.id === margin);
  return (found?.mm ?? 0) * MM_TO_PT;
}

export function paperLabel(id: PaperSizeId): string {
  return PAPER_SIZES.find((p) => p.id === id)?.label ?? id;
}

/**
 * ページサイズ（pt）を決定する。
 * @param paperSize   用紙サイズ
 * @param orientation 向き（auto は画像の縦横比に合わせる）
 * @param sourceWidth  トリミング・回転適用後の画像幅（px）
 * @param sourceHeight トリミング・回転適用後の画像高さ（px）
 */
export function computePageSize(
  paperSize: PaperSizeId,
  orientation: Orientation,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  if (paperSize === 'original') {
    const scale = 72 / ASSUMED_DPI;
    const width = Math.min(MAX_PAGE_PT, Math.max(1, sourceWidth * scale));
    const height = Math.min(MAX_PAGE_PT, Math.max(1, sourceHeight * scale));
    return { width, height };
  }

  const definition = PAPER_SIZES.find((p) => p.id === paperSize);
  const size = definition?.size ?? PAPER_SIZES[0]?.size;
  if (!size) return { width: 595.28, height: 841.89 };

  const [portraitWidth, portraitHeight] = size;
  const wantLandscape =
    orientation === 'landscape' ||
    (orientation === 'auto' && sourceWidth > sourceHeight);

  return wantLandscape
    ? { width: portraitHeight, height: portraitWidth }
    : { width: portraitWidth, height: portraitHeight };
}

/** 余白を考慮した描画領域に画像を収める（contain）矩形を求める */
export function fitRect(
  pageWidth: number,
  pageHeight: number,
  marginPt: number,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const availableWidth = Math.max(1, pageWidth - marginPt * 2);
  const availableHeight = Math.max(1, pageHeight - marginPt * 2);
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}
