/** 画像未選択のときに表示する取り込み画面 */

import { MAX_PAGES } from '../constants';
import { useBlobUrl } from '../hooks/useBlobUrl';
import { formatBytes, formatDateTime } from '../lib/util';
import type { HistoryEntry } from '../types';
import { IconCamera, IconChevronRight, IconDocument, IconHistory, IconImages } from './icons';

interface EmptyStateProps {
  dragActive: boolean;
  /** 最近作成した PDF（最大 3 件表示） */
  recent: HistoryEntry[];
  /** 編集途中のページ数（0 なら非表示） */
  pendingPages: number;
  onResume: () => void;
  onPickPhotos: () => void;
  onPickFiles: () => void;
  onOpenCamera: () => void;
  onOpenHistory: () => void;
}

export function EmptyState({
  dragActive,
  recent,
  pendingPages,
  onResume,
  onPickPhotos,
  onPickFiles,
  onOpenCamera,
  onOpenHistory,
}: EmptyStateProps) {
  return (
    <>
      {pendingPages > 0 ? (
        <button type="button" className="resume" onClick={onResume}>
          <span className="resume__icon">
            <IconImages size={20} />
          </span>
          <span className="resume__text">
            <span className="resume__title">編集中のページが {pendingPages} 枚あります</span>
            <span className="resume__desc">タップして続きから作業できます</span>
          </span>
          <IconChevronRight size={18} />
        </button>
      ) : null}

      <div className={`dropzone${dragActive ? ' dropzone--active' : ''}`}>
        <div className="dropzone__icon">
          <IconImages size={30} />
        </div>
        <h2 className="dropzone__title">画像を選んで PDF にまとめましょう</h2>
        <p className="dropzone__text">
          最大 {MAX_PAGES} 枚まで選べます。PDF ファイルを選ぶと、そのページも一緒にまとめられます。
          ここにドラッグ＆ドロップすることもできます。
        </p>
        <div className="dropzone__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={onPickPhotos}>
            <IconImages size={18} />
            写真を選ぶ
          </button>
          <button type="button" className="btn btn--lg" onClick={onOpenCamera}>
            <IconCamera size={18} />
            カメラで撮る
          </button>
          <button type="button" className="btn btn--lg" onClick={onPickFiles}>
            <IconDocument size={18} />
            ファイルを選ぶ
          </button>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="recent">
          <div className="recent__head">
            <IconHistory size={16} />
            <span className="recent__title">最近作成したPDF</span>
            <button type="button" className="btn btn--sm" onClick={onOpenHistory}>
              すべて見る
            </button>
          </div>
          {recent.slice(0, 3).map((entry) => (
            <RecentItem key={entry.id} entry={entry} onOpen={onOpenHistory} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function RecentItem({ entry, onOpen }: { entry: HistoryEntry; onOpen: () => void }) {
  const thumbnailUrl = useBlobUrl(entry.thumbnail);
  return (
    <button type="button" className="recent__item" onClick={onOpen}>
      <span className="recent__thumb">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <IconDocument size={16} />
        )}
      </span>
      <span className="recent__text">
        <span className="recent__name">{entry.fileName}</span>
        <span className="recent__meta">
          {entry.pageCount} ページ・{formatBytes(entry.byteSize)}・
          {formatDateTime(entry.createdAt)}
        </span>
      </span>
      <IconChevronRight size={18} />
    </button>
  );
}
