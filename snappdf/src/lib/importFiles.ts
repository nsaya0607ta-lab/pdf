/**
 * ファイル取り込み処理。
 * 画像ファイルと PDF ファイルの両方を受け取り、ページ配列へ変換する。
 */

import { QUALITIES } from '../constants';
import type { PageItem, QualityId } from '../types';
import { readCapturedAt } from './exif';
import { measureImage } from './imagePipeline';
import { rasterizePdf } from './pdf/pdfjs';
import { createId, stripExtension, throwIfAborted } from './util';

export interface ImportProgress {
  done: number;
  total: number;
  label: string;
}

export interface ImportOptions {
  /** 追加できる残り枚数 */
  remaining: number;
  /** PDF を取り込む際のラスタライズ画質 */
  quality: QualityId;
  signal?: AbortSignal;
  onProgress?: (progress: ImportProgress) => void;
}

export interface ImportResult {
  pages: PageItem[];
  /** 取り込めなかったファイル名と理由 */
  errors: Array<{ name: string; reason: string }>;
  /** 上限超過でスキップした数 */
  skippedByLimit: number;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name);
}

/** File[] を PageItem[] へ変換する */
export async function importFiles(
  files: File[],
  options: ImportOptions,
): Promise<ImportResult> {
  const pages: PageItem[] = [];
  const errors: ImportResult['errors'] = [];
  let skippedByLimit = 0;
  const total = files.length;
  let done = 0;

  const quality = QUALITIES.find((q) => q.id === options.quality) ?? QUALITIES[1];

  for (const file of files) {
    throwIfAborted(options.signal);
    options.onProgress?.({ done, total, label: `${file.name} を読み込み中` });

    if (pages.length >= options.remaining) {
      skippedByLimit += 1;
      done += 1;
      continue;
    }

    try {
      if (isPdf(file)) {
        const buffer = await file.arrayBuffer();
        const rasterized = await rasterizePdf(buffer, {
          maxEdge: quality?.maxEdge ?? 2339,
          jpegQuality: quality?.jpegQuality ?? 0.82,
          signal: options.signal,
          onProgress: (pageDone, pageTotal) => {
            options.onProgress?.({
              done,
              total,
              label: `${file.name} を展開中（${pageDone}/${pageTotal}）`,
            });
          },
        });
        const baseName = stripExtension(file.name);
        for (const raster of rasterized) {
          if (pages.length >= options.remaining) {
            skippedByLimit += 1;
            continue;
          }
          pages.push({
            id: createId('page'),
            name: `${baseName}_p${raster.pageNumber}`,
            origin: 'pdf',
            blob: raster.blob,
            mimeType: 'image/jpeg',
            naturalWidth: raster.width,
            naturalHeight: raster.height,
            byteSize: raster.blob.size,
            lastModified: file.lastModified,
            rotation: 0,
          });
        }
      } else if (isImage(file)) {
        const [size, capturedAt] = await Promise.all([
          measureImage(file),
          readCapturedAt(file),
        ]);
        pages.push({
          id: createId('page'),
          name: file.name,
          origin: 'image',
          blob: file,
          mimeType: file.type || 'image/jpeg',
          naturalWidth: size.width,
          naturalHeight: size.height,
          byteSize: file.size,
          lastModified: file.lastModified,
          ...(capturedAt ? { capturedAt } : {}),
          rotation: 0,
        });
      } else {
        errors.push({ name: file.name, reason: '対応していない形式です' });
      }
    } catch (error) {
      const reason =
        /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
          ? 'HEIC 形式はこのブラウザで読み込めません（JPEG でお試しください）'
          : error instanceof Error
            ? error.message
            : '読み込みに失敗しました';
      errors.push({ name: file.name, reason });
    }

    done += 1;
    options.onProgress?.({ done, total, label: `${done} / ${total} 件を処理` });
  }

  return { pages, errors, skippedByLimit };
}
