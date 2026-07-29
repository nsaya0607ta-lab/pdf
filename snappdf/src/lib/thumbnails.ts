/**
 * サムネイル／プレビュー画像のキャッシュ。
 *
 * - 表示に必要になったタイミングでのみ生成する（Lazy Load）
 * - 生成済み ObjectURL は LRU で保持し、上限を超えたら revoke してメモリを解放する
 * - 同時実行数を制限し、100 枚同時デコードによるメモリ枯渇を防ぐ
 */

import { THUMBNAIL_MAX_EDGE } from '../constants';
import type { EnhanceOptions, PageItem } from '../types';
import { renderViaWorker } from './pipelineClient';

/** 保持するサムネイル数の上限 */
const CACHE_LIMIT = 150;
/** 同時に走らせるレンダリング数 */
const CONCURRENCY = 3;

interface CacheEntry {
  url: string;
  size: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

let running = 0;
const queue: Array<() => void> = [];

/** 簡易セマフォ */
async function acquire(): Promise<() => void> {
  if (running < CONCURRENCY) {
    running += 1;
    return release;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  running += 1;
  return release;
}

function release(): void {
  running -= 1;
  const next = queue.shift();
  if (next) next();
}

/** 補正内容まで含めたキャッシュキー（内容が変われば作り直される） */
export function thumbnailKey(page: PageItem, enhance: EnhanceOptions, maxEdge: number): string {
  const crop = page.crop
    ? `${page.crop.x.toFixed(3)},${page.crop.y.toFixed(3)},${page.crop.width.toFixed(3)},${page.crop.height.toFixed(3)}`
    : 'full';
  const e = `${enhance.deskew ? 1 : 0}${enhance.brightness ? 1 : 0}${enhance.contrast ? 1 : 0}${enhance.monochrome ? 1 : 0}`;
  return `${page.id}|${page.rotation}|${crop}|${e}|${maxEdge}`;
}

/** キャッシュから取得、無ければ生成する */
export async function getThumbnailUrl(
  page: PageItem,
  enhance: EnhanceOptions,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): Promise<string> {
  const key = thumbnailKey(page, enhance, maxEdge);
  const cached = cache.get(key);
  if (cached) {
    // LRU: アクセスしたものを末尾へ移動
    cache.delete(key);
    cache.set(key, cached);
    return cached.url;
  }
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    const done = await acquire();
    try {
      const rendered = await renderViaWorker({
        id: page.id,
        blob: page.blob,
        rotation: page.rotation,
        crop: page.crop,
        enhance,
        maxEdge,
        // サムネイルは軽さ優先
        jpegQuality: maxEdge > 800 ? 0.85 : 0.7,
      });
      const url = URL.createObjectURL(rendered.blob);
      cache.set(key, { url, size: rendered.blob.size });
      evictIfNeeded();
      return url;
    } finally {
      done();
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

/** 上限を超えた古いエントリを解放する */
function evictIfNeeded(): void {
  while (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    const entry = cache.get(oldestKey);
    if (entry) URL.revokeObjectURL(entry.url);
    cache.delete(oldestKey);
  }
}

/** 特定ページのキャッシュを破棄する（削除時に呼ぶ） */
export function releaseThumbnails(pageId: string): void {
  for (const [key, entry] of cache) {
    if (key.startsWith(`${pageId}|`)) {
      URL.revokeObjectURL(entry.url);
      cache.delete(key);
    }
  }
}

/** すべて破棄する */
export function releaseAllThumbnails(): void {
  for (const [, entry] of cache) URL.revokeObjectURL(entry.url);
  cache.clear();
}
