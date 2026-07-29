/** PDF 分割ロジック（pdf-lib） */

import { PDFDocument } from 'pdf-lib';

/** 1 始まり・両端を含むページ範囲 */
export type PageRange = [start: number, end: number];

/**
 * 「1-3, 5, 8-10」のような入力を解析してページ範囲の配列にする。
 * @param input      ユーザー入力
 * @param pageCount  総ページ数（範囲外は丸める）
 */
export function parseRanges(input: string, pageCount: number): PageRange[] {
  const ranges: PageRange[] = [];
  const normalized = input.replace(/[〜～ー–—]/g, '-').replace(/[、，]/g, ',');
  for (const chunk of normalized.split(',')) {
    const text = chunk.trim();
    if (!text) continue;
    const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(text);
    if (!match) continue;
    const start = Math.max(1, Math.min(pageCount, Number(match[1])));
    const end = match[2] ? Math.max(1, Math.min(pageCount, Number(match[2]))) : start;
    ranges.push(start <= end ? [start, end] : [end, start]);
  }
  return ranges;
}

/** N ページごとに区切った範囲を作る */
export function chunkRanges(pageCount: number, size: number): PageRange[] {
  const step = Math.max(1, Math.floor(size));
  const ranges: PageRange[] = [];
  for (let start = 1; start <= pageCount; start += step) {
    ranges.push([start, Math.min(pageCount, start + step - 1)]);
  }
  return ranges;
}

export interface SplitPart {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

/**
 * 指定した範囲ごとに PDF を分割する。
 * @param baseName 出力ファイル名のベース（拡張子なし）
 */
export async function splitPdf(
  data: ArrayBuffer,
  ranges: PageRange[],
  baseName: string,
): Promise<SplitPart[]> {
  const source = await PDFDocument.load(data, { ignoreEncryption: true });
  const total = source.getPageCount();
  const parts: SplitPart[] = [];

  for (const [start, end] of ranges) {
    const from = Math.max(1, Math.min(total, start));
    const to = Math.max(1, Math.min(total, end));
    const indices: number[] = [];
    for (let i = from; i <= to; i += 1) indices.push(i - 1);
    if (indices.length === 0) continue;

    const target = await PDFDocument.create();
    const copied = await target.copyPages(source, indices);
    for (const page of copied) target.addPage(page);
    const bytes = await target.save({ useObjectStreams: true });
    const suffix = from === to ? `p${from}` : `p${from}-${to}`;
    parts.push({ name: `${baseName}_${suffix}.pdf`, bytes, pageCount: indices.length });
  }
  return parts;
}
