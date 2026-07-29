/* eslint-disable no-restricted-globals */
/**
 * 最小構成の Service Worker。
 * アプリシェルをキャッシュし、オフラインでも起動できるようにする。
 * 画像や PDF などのユーザーデータは一切キャッシュしない（プライバシー保護）。
 */

const CACHE_NAME = 'snap-pdf-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 別オリジン（CDN 等）は素通しする
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // ビルド成果物（JS/CSS/画像）はキャッシュしておく
          if (response.ok && /\.(js|mjs|css|svg|png|webmanifest)$/.test(url.pathname)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
