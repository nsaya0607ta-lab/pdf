/**
 * PDF の再圧縮。
 *
 * 既存 PDF の各ページを画像としてラスタライズし直し、
 * 指定した画質で PDF を組み直すことでファイルサイズを削減する。
 * 画像から作った PDF・外部から読み込んだ PDF のどちらにも使える。
 */

import { QUALITIES } from '../../constants';
import type { BuildPageSpec, PdfSettings, QualityId } from '../../types';
import { NO_ENHANCE } from '../pageUtils';
import { buildPdfViaWorker } from '../pipelineClient';
import { createId } from '../util';
import { rasterizePdf } from './pdfjs';

export interface CompressOptions {
  quality: QualityId;
  fileName: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, label: string) => void;
}

export async function compressPdf(
  bytes: ArrayBuffer,
  options: CompressOptions,
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const preset = QUALITIES.find((q) => q.id === options.quality) ?? QUALITIES[1];
  const maxEdge = preset?.maxEdge ?? 2339;
  const jpegQuality = preset?.jpegQuality ?? 0.82;

  // 1) 既存 PDF を画像へ展開
  const rasterized = await rasterizePdf(bytes, {
    maxEdge,
    jpegQuality,
    signal: options.signal,
    onProgress: (done, total) => options.onProgress?.(done, total * 2, 'ページを展開中'),
  });

  // 2) 展開した画像から PDF を組み直す（元のページサイズを保つため「元画像サイズ」で出力）
  const pages: BuildPageSpec[] = rasterized.map((raster) => ({
    id: createId('compress'),
    blob: raster.blob,
    rotation: 0,
    enhance: NO_ENHANCE,
    maxEdge,
    jpegQuality,
    sourceWidth: raster.width,
    sourceHeight: raster.height,
  }));

  const settings: PdfSettings = {
    paperSize: 'original',
    orientation: 'auto',
    margin: 'none',
    quality: options.quality,
    fileName: options.fileName,
    searchableText: false,
  };

  return buildPdfViaWorker(
    { pages, settings },
    {
      signal: options.signal,
      onProgress: (done, total) =>
        options.onProgress?.(rasterized.length + done, rasterized.length + total, 'PDFを再構成中'),
    },
  );
}
