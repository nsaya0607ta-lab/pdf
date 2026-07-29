/// <reference lib="webworker" />
/**
 * 画像処理と PDF 生成を担当する Web Worker。
 *
 * 重い処理をこのスレッドへ逃がすことで、
 * 100 枚規模の画像を扱っても UI（メインスレッド）が固まらないようにしている。
 */

import { installPolyfills } from '../lib/polyfills';
import { renderImage } from '../lib/imagePipeline';
import { buildPdf } from '../lib/pdf/build';
import { CancelledError, toMessage } from '../lib/util';
import type { WorkerRequest, WorkerResponse } from '../types';

installPolyfills();

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** キャンセル要求を受けたジョブ ID */
const cancelledJobs = new Set<string>();

function post(message: WorkerResponse, transfer?: Transferable[]): void {
  if (transfer && transfer.length > 0) {
    ctx.postMessage(message, transfer);
  } else {
    ctx.postMessage(message);
  }
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === 'cancel') {
    cancelledJobs.add(request.jobId);
    return;
  }

  const { jobId } = request;
  try {
    switch (request.type) {
      case 'render': {
        const rendered = await renderImage(request.spec);
        if (cancelledJobs.has(jobId)) {
          post({ type: 'cancelled', jobId });
          break;
        }
        post({
          type: 'render',
          jobId,
          blob: rendered.blob,
          width: rendered.width,
          height: rendered.height,
        });
        break;
      }
      case 'buildPdf': {
        const result = await buildPdf(request.payload, {
          isCancelled: () => cancelledJobs.has(jobId),
          onProgress: ({ done, total, label }) => {
            post({ type: 'progress', jobId, done, total, label });
          },
        });
        // ArrayBuffer は転送（コピーを避けてメモリ使用量を抑える）
        const buffer = result.bytes.buffer.slice(
          result.bytes.byteOffset,
          result.bytes.byteOffset + result.bytes.byteLength,
        ) as ArrayBuffer;
        post({ type: 'buildPdf', jobId, bytes: buffer, pageCount: result.pageCount }, [buffer]);
        break;
      }
      default: {
        post({ type: 'error', jobId, message: '未対応の処理です' });
      }
    }
  } catch (error) {
    if (error instanceof CancelledError || cancelledJobs.has(jobId)) {
      post({ type: 'cancelled', jobId });
    } else {
      post({ type: 'error', jobId, message: toMessage(error) });
    }
  } finally {
    cancelledJobs.delete(jobId);
  }
};
