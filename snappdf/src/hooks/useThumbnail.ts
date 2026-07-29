import { useEffect, useRef, useState } from 'react';
import { THUMBNAIL_MAX_EDGE } from '../constants';
import { getThumbnailUrl } from '../lib/thumbnails';
import type { EnhanceOptions, PageItem } from '../types';

/**
 * 要素が画面内に入ったときだけサムネイルを生成する Lazy Load フック。
 * @returns [ref, url, error]
 */
export function useThumbnail(
  page: PageItem,
  enhance: EnhanceOptions,
  maxEdge: number = THUMBNAIL_MAX_EDGE,
): [React.RefObject<HTMLDivElement | null>, string | null, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // 画面内に入ったかどうかを監視する
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      // 少し手前から先読みしてスクロールを滑らかにする
      { rootMargin: '400px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const signature = `${page.id}|${page.rotation}|${JSON.stringify(page.crop ?? null)}|${JSON.stringify(enhance)}|${maxEdge}`;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setFailed(false);
    getThumbnailUrl(page, enhance, maxEdge)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // signature が変わったときだけ作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, signature]);

  return [ref, url, failed];
}
