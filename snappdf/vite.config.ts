import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite 設定
 * - base: './' … 静的ホスティング（サブディレクトリ配信）でも動くように相対パス出力
 * - worker.format: 'es' … Web Worker を ES モジュールとして出力（動的 import を使うため）
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 初期表示を軽くするため、重いライブラリを別チャンクへ分離する
        manualChunks: {
          'pdf-lib': ['pdf-lib'],
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
