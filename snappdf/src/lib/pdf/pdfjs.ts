/**
 * pdf.js の初期化と、既存 PDF のラスタライズ処理。
 *
 * pdf.js は自前の Worker を持つため、解析処理は自動的に別スレッドで行われる。
 * ここではメインスレッドの canvas へ描画し、ページ画像 Blob を取り出す。
 */

import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { canvasToBlob, createCanvas, get2dContext } from '../imagePipeline';
import { CancelledError, throwIfAborted, yieldToUi } from '../util';
import { assetUrl } from '../env';

let workerConfigured = false;

/** pdf.js の worker を 1 度だけ設定する */
function ensureWorker(): void {
  if (workerConfigured) return;
  // 単一 HTML 配布版では Blob URL を差し込む（scripts/build-standalone.mjs 参照）
  const inlineUrl = (globalThis as { __SNAPPDF_PDFJS_WORKER_URL__?: string })
    .__SNAPPDF_PDFJS_WORKER_URL__;
  pdfjs.GlobalWorkerOptions.workerSrc = inlineUrl ?? assetUrl('pdf.worker.min.mjs');
  workerConfigured = true;
}

export interface RasterizedPage {
  blob: Blob;
  width: number;
  height: number;
  pageNumber: number;
}

export interface RasterizeOptions {
  /** 長辺の最大ピクセル数 */
  maxEdge: number;
  /** JPEG 品質 */
  jpegQuality: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** PDF を読み込み、ページ数などのメタ情報を取得する */
export async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  ensureWorker();
  // pdf.js は渡した ArrayBuffer を破壊的に扱うためコピーを渡す
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  return task.promise;
}

/**
 * PDF の各ページを画像へ変換する。
 * PDF 結合（既存 PDF を画像ページとして取り込む）や PDF 再圧縮で使用する。
 */
export async function rasterizePdf(
  data: ArrayBuffer,
  options: RasterizeOptions,
): Promise<RasterizedPage[]> {
  const doc = await loadPdf(data);
  const results: RasterizedPage[] = [];
  try {
    const total = doc.numPages;
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      throwIfAborted(options.signal);
      const page = await doc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        4,
        options.maxEdge / Math.max(baseViewport.width, baseViewport.height),
      );
      const viewport = page.getViewport({ scale: Math.max(0.2, scale) });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = get2dContext(canvas);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      const blob = await canvasToBlob(canvas, 'image/jpeg', options.jpegQuality);
      results.push({ blob, width: canvas.width, height: canvas.height, pageNumber });
      page.cleanup();
      options.onProgress?.(pageNumber, total);
      // 大量ページでも UI が固まらないように制御を返す
      await yieldToUi();
    }
    return results;
  } catch (error) {
    if (options.signal?.aborted) throw new CancelledError();
    throw error;
  } finally {
    await doc.destroy();
  }
}

/** PDF のページ数だけを調べる */
export async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  const doc = await loadPdf(data);
  const count = doc.numPages;
  await doc.destroy();
  return count;
}
