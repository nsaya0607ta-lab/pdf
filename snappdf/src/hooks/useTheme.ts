import { useEffect } from 'react';
import type { ThemeMode } from '../types';

/**
 * テーマ（ライト / ダーク / システム連動）を html 要素へ反映する。
 * CSS 側は [data-theme] 属性で色を切り替える。
 */
export function useTheme(mode: ThemeMode): void {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
      root.dataset['theme'] = resolved;
      // アドレスバーの色も合わせる
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#111418' : '#ffffff');
    };

    apply();
    if (mode === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [mode]);
}
