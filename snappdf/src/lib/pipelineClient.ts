/**
 * Web Worker のクライアント。
 *
 * - Worker が使える環境ではすべての重い処理を Worker で実行する
 * - OffscreenCanvas 非対応など Worker が使えない環境では、
 *   同じ関数をメインスレッドで実行してフォールバックする（機能は落とさない）
 *
 * 呼び出し側はこのモジュールだけを見ればよく、実行場所を意識しなくてよい。
 */

import type {
  BuildPdfRequest,
  RenderSpec,
  WorkerRequest,
  WorkerResponse,
} from '../types';
import { renderImage, supportsOffscreenCanvas } from './imagePipeline';
import { buildPdf } from './pdf/build';
import { CancelledError, createId, toMessage } from './util';

/** ローカルビルド（esbuild 等）で worker のパスを差し替えるための定義 */
declare const __PIPELINE_WORKER_URL__: string | undefined;

export interface JobHandlers {
  onProgress?: (done: number, total: number, label?: string) => void;
  signal?: AbortSignal;
}

interface PendingJob {
  resolve: (value: WorkerResponse) => void;
  reject: (error: unknown) => void;
  onProgress?: (done: number, total: number, label?: string) => void;
}

let worker: Worker | null = null;
let workerUnavailable = false;
const pending = new Map<string, PendingJob>();

/** Worker を遅延生成する。生成に失敗した場合は null（＝メインスレッド実行） */
function getWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (worker) return worker;
  if (typeof Worker === 'undefined' || !supportsOffscreenCanvas()) {
    workerUnavailable = true;
    return null;
  }
  try {
    // 単一 HTML 配布版では Blob URL を差し込む（scripts/build-standalone.mjs 参照）
    const inlineUrl = (globalThis as { __SNAPPDF_WORKER_URL__?: string }).__SNAPPDF_WORKER_URL__;
    const override =
      inlineUrl ??
      (typeof __PIPELINE_WORKER_URL__ !== 'undefined' ? __PIPELINE_WORKER_URL__ : undefined);
    const url = override
      ? new URL(override, import.meta.url)
      : new URL('../workers/pipeline.worker.ts', import.meta.url);
    const instance = new Worker(url, { type: 'module' });

    instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const job = pending.get(message.jobId);
      if (!job) return;
      if (message.type === 'progress') {
        job.onProgress?.(message.done, message.total, message.label);
        return;
      }
      pending.delete(message.jobId);
      if (message.type === 'error') {
        job.reject(new Error(message.message));
      } else if (message.type === 'cancelled') {
        job.reject(new CancelledError());
      } else {
        job.resolve(message);
      }
    };

    instance.onerror = () => {
      // Worker を起動できない環境（file:// や厳しい CSP 下など）では
      // メインスレッド実行へフォールバックできるよう専用のエラーで通知する
      workerUnavailable = true;
      worker = null;
      for (const [, job] of pending) job.reject(new Error('WORKER_UNAVAILABLE'));
      pending.clear();
      try {
        instance.terminate();
      } catch {
        /* 破棄できなくても問題ない */
      }
    };

    worker = instance;
    return instance;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

/** Worker へジョブを送り、完了レスポンスを待つ */
function dispatch(request: WorkerRequest, handlers: JobHandlers = {}): Promise<WorkerResponse> {
  const instance = getWorker();
  if (!instance) return Promise.reject(new Error('WORKER_UNAVAILABLE'));

  return new Promise<WorkerResponse>((resolve, reject) => {
    if (request.type === 'cancel') {
      instance.postMessage(request);
      resolve({ type: 'cancelled', jobId: request.jobId });
      return;
    }
    pending.set(request.jobId, { resolve, reject, onProgress: handlers.onProgress });

    const abortHandler = () => {
      instance.postMessage({ type: 'cancel', jobId: request.jobId } satisfies WorkerRequest);
    };
    handlers.signal?.addEventListener('abort', abortHandler, { once: true });

    try {
      instance.postMessage(request);
    } catch (error) {
      pending.delete(request.jobId);
      reject(error);
    }
  });
}

/** 画像 1 枚をレンダリングする（サムネイル／プレビュー／OCR 用） */
export async function renderViaWorker(
  spec: RenderSpec,
  handlers: JobHandlers = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const jobId = createId('render');
  try {
    const response = await dispatch({ type: 'render', jobId, spec }, handlers);
    if (response.type !== 'render') throw new Error('レンダリングに失敗しました');
    return { blob: response.blob, width: response.width, height: response.height };
  } catch (error) {
    if (isWorkerUnavailable(error)) {
      const rendered = await renderImage(spec);
      return { blob: rendered.blob, width: rendered.width, height: rendered.height };
    }
    throw error;
  }
}

/** PDF を生成する */
export async function buildPdfViaWorker(
  payload: BuildPdfRequest,
  handlers: JobHandlers = {},
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const jobId = createId('build');
  try {
    const response = await dispatch({ type: 'buildPdf', jobId, payload }, handlers);
    if (response.type !== 'buildPdf') throw new Error('PDF の生成に失敗しました');
    return { bytes: new Uint8Array(response.bytes), pageCount: response.pageCount };
  } catch (error) {
    if (isWorkerUnavailable(error)) {
      // メインスレッド実行（進捗・キャンセルは同じインターフェースで扱える）
      return buildPdf(payload, {
        onProgress: ({ done, total, label }) => handlers.onProgress?.(done, total, label),
        isCancelled: () => handlers.signal?.aborted ?? false,
      });
    }
    throw error;
  }
}

function isWorkerUnavailable(error: unknown): boolean {
  return toMessage(error) === 'WORKER_UNAVAILABLE';
}

/** アプリ終了時などに Worker を破棄する */
export function terminatePipeline(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}
