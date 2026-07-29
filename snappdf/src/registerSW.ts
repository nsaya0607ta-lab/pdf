/**
 * Service Worker の登録。
 * 本番ビルドかつ https（または localhost）のときだけ登録する。
 */

import { assetUrl, IS_PRODUCTION } from './lib/env';

export function registerServiceWorker(): void {
  if (!IS_PRODUCTION) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // 単一 HTML ファイル版には sw.js が存在しないため登録しない
  if ((globalThis as { __SNAPPDF_WORKER_URL__?: string }).__SNAPPDF_WORKER_URL__) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(assetUrl('sw.js')).catch(() => {
      // 登録に失敗してもアプリ自体は動作するため無視する
    });
  });
}
