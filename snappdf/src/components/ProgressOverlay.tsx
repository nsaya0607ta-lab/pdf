/**
 * 処理中のオーバーレイ。
 * 進捗バーとキャンセルボタンを表示し、重い処理中でも状況が分かるようにする。
 */

import type { ProgressState } from '../types';

interface ProgressOverlayProps {
  progress: ProgressState;
  onCancel: () => void;
}

export function ProgressOverlay({ progress, onCancel }: ProgressOverlayProps) {
  const percent = progress.ratio === null ? null : Math.round(progress.ratio * 100);

  return (
    <div className="progress-overlay" role="alertdialog" aria-live="polite" aria-busy="true">
      <div className="progress-card">
        <div className="progress-card__label">{progress.label}</div>
        <div className="progress-card__detail">
          {progress.detail ?? (percent !== null ? `${percent}%` : 'しばらくお待ちください')}
        </div>
        <div
          className={`progress-bar${percent === null ? ' progress-bar--indeterminate' : ''}`}
          role="progressbar"
          aria-valuenow={percent ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="progress-bar__fill"
            style={percent === null ? undefined : { width: `${percent}%` }}
          />
        </div>
        {progress.cancellable ? (
          <button type="button" className="btn btn--block" style={{ marginTop: 18 }} onClick={onCancel}>
            キャンセル
          </button>
        ) : null}
      </div>
    </div>
  );
}
