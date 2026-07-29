/**
 * ページ一覧グリッド。
 *
 * 並び替えは Pointer Events による自前実装。
 * ドラッグ中は「今どのカードの上にいるか」を elementFromPoint で判定し、
 * その場で配列を入れ替える（ライブ並び替え）。
 * ライブラリに依存しないためバンドルが軽く、タッチ操作にもそのまま対応できる。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveEnhance } from '../lib/pageUtils';
import type { EnhanceOptions, PageItem } from '../types';
import { PageCard } from './PageCard';

interface PageGridProps {
  pages: PageItem[];
  selectionMode: boolean;
  selectedIds: string[];
  enhanceDefaults: EnhanceOptions;
  autoEnhanceEnabled: boolean;
  onReorder: (from: number, to: number) => void;
  onOpen: (index: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

/** ドラッグ中に画面端へ近づいたら自動スクロールする距離（px） */
const EDGE_THRESHOLD = 90;

export function PageGrid({
  pages,
  selectionMode,
  selectedIds,
  enhanceDefaults,
  autoEnhanceEnabled,
  onReorder,
  onOpen,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleSelect,
}: PageGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const pointerYRef = useRef(0);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const tickAutoScroll = useCallback(() => {
    const y = pointerYRef.current;
    const height = window.innerHeight;
    let delta = 0;
    if (y < EDGE_THRESHOLD) delta = -Math.ceil((EDGE_THRESHOLD - y) / 6);
    else if (y > height - EDGE_THRESHOLD) delta = Math.ceil((y - (height - EDGE_THRESHOLD)) / 6);
    if (delta !== 0) window.scrollBy(0, delta);
    autoScrollRef.current = requestAnimationFrame(tickAutoScroll);
  }, []);

  const handleDragStart = useCallback(
    (event: React.PointerEvent, id: string) => {
      event.preventDefault();
      event.stopPropagation();
      draggingIdRef.current = id;
      setDraggingId(id);
      pointerYRef.current = event.clientY;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      stopAutoScroll();
      autoScrollRef.current = requestAnimationFrame(tickAutoScroll);
    },
    [stopAutoScroll, tickAutoScroll],
  );

  // ドラッグ中のポインタ移動を document で監視する
  useEffect(() => {
    if (!draggingId) return;

    const onPointerMove = (event: PointerEvent) => {
      const id = draggingIdRef.current;
      if (!id) return;
      event.preventDefault();
      pointerYRef.current = event.clientY;

      const element = document.elementFromPoint(event.clientX, event.clientY);
      const card = element?.closest('[data-page-index]') as HTMLElement | null;
      if (!card) return;
      const targetIndex = Number(card.dataset['pageIndex']);
      if (Number.isNaN(targetIndex)) return;

      const currentIndex = pages.findIndex((page) => page.id === id);
      if (currentIndex < 0 || currentIndex === targetIndex) return;
      onReorder(currentIndex, targetIndex);
    };

    const onPointerUp = () => {
      draggingIdRef.current = null;
      setDraggingId(null);
      stopAutoScroll();
    };

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [draggingId, pages, onReorder, stopAutoScroll]);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  return (
    <div className="grid" role="list" aria-label="ページ一覧">
      {pages.map((page, index) => (
        <PageCard
          key={page.id}
          page={page}
          index={index}
          enhance={resolveEnhance(page, enhanceDefaults, autoEnhanceEnabled)}
          selectionMode={selectionMode}
          selected={selectedIds.includes(page.id)}
          dragging={draggingId === page.id}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onToggleSelect={onToggleSelect}
          onDragStart={handleDragStart}
        />
      ))}
    </div>
  );
}
