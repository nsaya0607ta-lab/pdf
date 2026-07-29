/**
 * OCR（文字認識）。
 *
 * Tesseract.js を動的読み込みして利用する。
 * バンドルサイズを増やさないため既定では CDN から読み込むが、
 * `npm i tesseract.js` してから .env で VITE_TESSERACT_URL を指定すれば
 * ローカル（オフライン）でも動作させられる。
 *
 * 認識結果は単語ごとの座標付きで保持しており、
 * PDF 生成時に不可視テキスト層として重ねることで検索可能 PDF になる。
 */

import { OCR_LANGUAGES, OCR_MAX_EDGE, TESSERACT_MODULE_URL } from '../constants';
import type { OcrResult, OcrWord, PageItem } from '../types';
import { renderImage } from './imagePipeline';
import { resolveEnhance } from './pageUtils';
import { CancelledError, throwIfAborted } from './util';

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractResult {
  data: { text: string; words?: TesseractWord[] };
}

interface TesseractWorker {
  recognize: (image: Blob | string) => Promise<TesseractResult>;
  terminate: () => Promise<unknown>;
}

interface TesseractModule {
  createWorker: (
    langs: string,
    oem?: number,
    options?: { logger?: (message: { status: string; progress: number }) => void },
  ) => Promise<TesseractWorker>;
}

let workerPromise: Promise<TesseractWorker> | null = null;
let progressListener: ((ratio: number, status: string) => void) | null = null;

/** OCR エンジンが利用可能かどうか（読み込み失敗時は false） */
export async function isOcrAvailable(): Promise<boolean> {
  try {
    await getWorker();
    return true;
  } catch {
    return false;
  }
}

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const module = (await import(/* @vite-ignore */ TESSERACT_MODULE_URL)) as
        | TesseractModule
        | { default: TesseractModule };
      const tesseract = 'createWorker' in module ? module : module.default;
      if (!tesseract?.createWorker) {
        throw new Error('OCR エンジンを読み込めませんでした');
      }
      return tesseract.createWorker(OCR_LANGUAGES, 1, {
        logger: (message) => {
          if (message.status === 'recognizing text') {
            progressListener?.(message.progress, '文字を認識中');
          } else {
            progressListener?.(message.progress, '言語データを準備中');
          }
        },
      });
    })().catch((error: unknown) => {
      workerPromise = null;
      throw error instanceof Error
        ? new Error(`OCR エンジンの初期化に失敗しました（${error.message}）`)
        : new Error('OCR エンジンの初期化に失敗しました');
    });
  }
  return workerPromise;
}

/** OCR エンジンを解放してメモリを戻す */
export async function releaseOcr(): Promise<void> {
  const current = workerPromise;
  workerPromise = null;
  if (!current) return;
  try {
    const worker = await current;
    await worker.terminate();
  } catch {
    // 解放時のエラーは無視してよい
  }
}

export interface OcrRunOptions {
  onProgress?: (ratio: number, status: string) => void;
  signal?: AbortSignal;
  /** 自動補正の既定値（ページ個別設定が無い場合に使用） */
  defaultEnhance: PageItem['enhance'];
  autoEnhanceEnabled: boolean;
}

/**
 * 1 ページに OCR をかける。
 * OCR 精度を上げるため、コントラスト補正を有効にした画像を渡す。
 */
export async function runOcr(page: PageItem, options: OcrRunOptions): Promise<OcrResult> {
  throwIfAborted(options.signal);
  const worker = await getWorker();
  throwIfAborted(options.signal);

  const enhance = resolveEnhance(page, options.defaultEnhance, options.autoEnhanceEnabled);
  const rendered = await renderImage({
    id: page.id,
    blob: page.blob,
    rotation: page.rotation,
    crop: page.crop,
    // OCR では白黒化しない方が安定するため、明るさ・コントラストのみ有効化
    enhance: { ...enhance, monochrome: false },
    maxEdge: OCR_MAX_EDGE,
    jpegQuality: 0.9,
  });

  progressListener = options.onProgress ?? null;
  try {
    throwIfAborted(options.signal);
    const result = await worker.recognize(rendered.blob);
    if (options.signal?.aborted) throw new CancelledError();

    const words: OcrWord[] = (result.data.words ?? [])
      .filter((word) => word.text.trim().length > 0)
      .map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox,
      }));

    return {
      text: result.data.text.trim(),
      words,
      imageWidth: rendered.width,
      imageHeight: rendered.height,
      updatedAt: Date.now(),
    };
  } finally {
    progressListener = null;
  }
}
