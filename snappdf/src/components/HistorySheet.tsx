/**
 * 作成した PDF の履歴。
 * 端末内（IndexedDB）に保存されているので、アプリを閉じても残る。
 */

import { useBlobUrl } from '../hooks/useBlobUrl';
import { canShareFiles } from '../lib/share';
import { formatBytes, formatDateTime } from '../lib/util';
import type { HistoryEntry } from '../types';
import {
  IconDocument,
  IconDownload,
  IconEdit,
  IconPrint,
  IconShare,
  IconTrash,
} from './icons';
import { Sheet, SwitchRow } from './ui';

interface HistorySheetProps {
  entries: HistoryEntry[];
  keepHistory: boolean;
  onKeepHistoryChange: (enabled: boolean) => void;
  onSave: (entry: HistoryEntry) => void;
  onShare: (entry: HistoryEntry) => void;
  onPrint: (entry: HistoryEntry) => void;
  onReuse: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function HistorySheet({
  entries,
  keepHistory,
  onKeepHistoryChange,
  onSave,
  onShare,
  onPrint,
  onReuse,
  onDelete,
  onClearAll,
  onClose,
}: HistorySheetProps) {
  const shareable = canShareFiles();

  return (
    <Sheet title="作成したPDF" onClose={onClose} wide>
      {entries.length === 0 ? (
        <div className="history-empty">
          <IconDocument size={36} />
          <p className="dropzone__title" style={{ fontSize: 16 }}>
            まだPDFがありません
          </p>
          <p className="muted">
            PDFを作成すると、ここに履歴として残ります。
            <br />
            保存し忘れても、あとからここで保存・共有できます。
          </p>
        </div>
      ) : (
        <div className="history-list">
          {entries.map((entry) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              shareable={shareable}
              onSave={onSave}
              onShare={onShare}
              onPrint={onPrint}
              onReuse={onReuse}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <SwitchRow
          title="作成したPDFを端末に保存する"
          description="オフにすると履歴を残しません（保存済みの履歴はそのままです）"
          checked={keepHistory}
          onChange={onKeepHistoryChange}
        />
      </div>

      {entries.length > 0 ? (
        <button
          type="button"
          className="btn btn--danger btn--block"
          style={{ marginTop: 14 }}
          onClick={() => {
            if (window.confirm('履歴をすべて削除しますか？（保存済みのPDFファイルは消えません）')) {
              onClearAll();
            }
          }}
        >
          <IconTrash size={18} />
          履歴をすべて削除
        </button>
      ) : null}

      <p className="field__hint" style={{ marginTop: 12 }}>
        履歴はこの端末の中だけに保存されます。外部へ送信されることはありません。
      </p>
    </Sheet>
  );
}

interface HistoryRowProps {
  entry: HistoryEntry;
  shareable: boolean;
  onSave: (entry: HistoryEntry) => void;
  onShare: (entry: HistoryEntry) => void;
  onPrint: (entry: HistoryEntry) => void;
  onReuse: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
}

function HistoryRow({
  entry,
  shareable,
  onSave,
  onShare,
  onPrint,
  onReuse,
  onDelete,
}: HistoryRowProps) {
  const thumbnailUrl = useBlobUrl(entry.thumbnail);

  return (
    <div className="history-item">
      <div className="history-item__thumb">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <IconDocument size={22} />
        )}
      </div>

      <div className="history-item__body">
        <div className="history-item__name" title={entry.fileName}>
          {entry.fileName}
        </div>
        <div className="history-item__meta">
          {entry.pageCount} ページ・{formatBytes(entry.byteSize)}
          <br />
          {formatDateTime(entry.createdAt)}
        </div>
        <div className="history-item__actions">
          <button type="button" className="btn btn--sm" onClick={() => onSave(entry)}>
            <IconDownload size={15} />
            保存
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => onShare(entry)}
            disabled={!shareable}
            title={shareable ? '他のアプリへ送信' : 'このブラウザでは共有できません'}
          >
            <IconShare size={15} />
            共有
          </button>
          <button type="button" className="btn btn--sm" onClick={() => onPrint(entry)}>
            <IconPrint size={15} />
            印刷
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => onReuse(entry)}
            title="ページとして読み込み、編集し直します"
          >
            <IconEdit size={15} />
            編集
          </button>
          <button
            type="button"
            className="btn btn--sm btn--danger"
            onClick={() => onDelete(entry)}
            aria-label={`${entry.fileName} を履歴から削除`}
          >
            <IconTrash size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

