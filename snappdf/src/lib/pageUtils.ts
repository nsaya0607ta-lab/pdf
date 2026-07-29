/** ページ配列に対する純粋な操作ユーティリティ（reducer から利用） */

import { DEFAULT_ENHANCE } from '../constants';
import type { EnhanceOptions, PageItem, Rotation, SortDirection, SortKey } from '../types';
import { compareNames, createId } from './util';

/** ページに適用する自動補正設定を解決する（個別設定 > グローバル設定 > 無効） */
export function resolveEnhance(
  page: Pick<PageItem, 'enhance'>,
  defaultEnhance: EnhanceOptions | undefined,
  autoEnhanceEnabled: boolean,
): EnhanceOptions {
  if (page.enhance) return page.enhance;
  if (!autoEnhanceEnabled) {
    return { deskew: false, brightness: false, contrast: false, monochrome: false };
  }
  return defaultEnhance ?? DEFAULT_ENHANCE;
}

/** 補正が実質的に無効かどうか */
export const NO_ENHANCE: EnhanceOptions = {
  deskew: false,
  brightness: false,
  contrast: false,
  monochrome: false,
};

/** 配列内の要素を from → to へ移動した新しい配列を返す */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items.slice();
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items.slice();
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
  return next;
}

/** 指定キーで並び替える */
export function sortPages(
  pages: readonly PageItem[],
  key: SortKey,
  direction: SortDirection,
): PageItem[] {
  const factor = direction === 'asc' ? 1 : -1;
  return pages.slice().sort((a, b) => {
    let result: number;
    switch (key) {
      case 'name':
        result = compareNames(a.name, b.name);
        break;
      case 'lastModified':
        result = a.lastModified - b.lastModified;
        break;
      case 'capturedAt': {
        // 撮影日時が無いものは末尾へ寄せる
        const av = a.capturedAt ?? a.lastModified;
        const bv = b.capturedAt ?? b.lastModified;
        result = av - bv;
        break;
      }
      default:
        result = 0;
    }
    if (result === 0) result = compareNames(a.name, b.name);
    return result * factor;
  });
}

/** ページを複製する（同じ Blob を共有するのでメモリ消費は増えない） */
export function duplicatePage(page: PageItem): PageItem {
  return {
    ...page,
    id: createId('page'),
    name: `${page.name}（複製）`,
    // OCR 結果は引き継ぐが、参照は切り離す
    ...(page.ocr ? { ocr: { ...page.ocr } } : {}),
  };
}

/** 回転角度を加算して 0〜270 に正規化する */
export function rotateBy(rotation: Rotation, delta: number): Rotation {
  const next = (((rotation + delta) % 360) + 360) % 360;
  return next as Rotation;
}

/**
 * 回転・トリミングを適用した後の実ピクセルサイズ。
 * トリミング領域は「回転後の見た目」基準で保持しているため、
 * まず回転後の全体サイズを求めてから比率を掛ける。
 */
export function sourceSize(page: PageItem): { width: number; height: number } {
  const swapped = page.rotation === 90 || page.rotation === 270;
  const fullWidth = swapped ? page.naturalHeight : page.naturalWidth;
  const fullHeight = swapped ? page.naturalWidth : page.naturalHeight;
  const cropW = page.crop ? page.crop.width : 1;
  const cropH = page.crop ? page.crop.height : 1;
  return {
    width: Math.max(1, Math.round(fullWidth * cropW)),
    height: Math.max(1, Math.round(fullHeight * cropH)),
  };
}

/** 回転・トリミングを考慮した表示上の縦横比 */
export function displayAspectRatio(page: PageItem): number {
  const { width, height } = sourceSize(page);
  return height === 0 ? 1 : width / height;
}
