/**
 * PDF 作成後の結果画面。
 * 保存・共有・印刷に加えて、再圧縮と分割もここから実行できる。
 */

import { useState } from 'react';
import { QUALITIES } from '../constants';
import { canShareFiles } from '../lib/share';
import { formatBytes, formatDateTime } from '../lib/util';
import type { GeneratedPdf, QualityId } from '../types';
import {
  IconCompress,
  IconDocument,
  IconDownload,
  IconPrint,
  IconShare,
  IconSplit,
} from './icons';
import { Field, SegmentedControl, Sheet } from './ui';

interface ResultSheetProps {
  result: GeneratedPdf;
  /** 履歴に保存されるかどうか（案内文の出し分けに使う） */
  keepHistory: boolean;
  onOpenHistory: () => void;
  onSave: () => void;
  onShare: () => void;
  onPrint: () => void;
  onCompress: (quality: QualityId) => void;
  onSplit: (mode: 'ranges' | 'every' | 'single', value: string) => void;
  onClose: () => void;
}

export function ResultSheet({
  result,
  keepHistory,
  onOpenHistory,
  onSave,
  onShare,
  onPrint,
  onCompress,
  onSplit,
  onClose,
}: ResultSheetProps) {
  const [panel, setPanel] = useState<'none' | 'compress' | 'split'>('none');
  const [compressQuality, setCompressQuality] = useState<QualityId>(
    result.quality === 'high' ? 'standard' : 'light',
  );
  const [splitMode, setSplitMode] = useState<'ranges' | 'every' | 'single'>('ranges');
  const [splitValue, setSplitValue] = useState('1');
  const shareable = canShareFiles();

  return (
    <Sheet
      title="PDF ができました"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onSave}>
          <IconDownload size={18} />
          保存する
        </button>
      }
    >
      <div className="result-summary">
        <div className="result-summary__icon">
          <IconDocument size={22} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="result-summary__name">{result.fileName}</div>
          <div className="result-summary__meta">
            {result.pageCount} ページ　·　{formatBytes(result.byteSize)}　·{' '}
            {formatDateTime(result.createdAt)}
          </div>
        </div>
      </div>

      <div className="action-grid">
        <button type="button" className="action-tile" onClick={onSave}>
          <IconDownload />
          保存
        </button>
        <button
          type="button"
          className="action-tile"
          onClick={onShare}
          disabled={!shareable}
          title={shareable ? '他のアプリへ送信' : 'このブラウザでは共有できません'}
        >
          <IconShare />
          共有・送信
        </button>
        <button type="button" className="action-tile" onClick={onPrint}>
          <IconPrint />
          印刷
        </button>
        <button
          type="button"
          className="action-tile"
          onClick={() => setPanel(panel === 'compress' ? 'none' : 'compress')}
        >
          <IconCompress />
          圧縮
        </button>
      </div>

      {keepHistory ? (
        <p className="notice" style={{ marginTop: 12 }}>
          このPDFは<strong>アプリの履歴に保存されました</strong>。
          あとからでも保存・共有・印刷できます。
          <button
            type="button"
            className="btn btn--sm"
            style={{ marginLeft: 8 }}
            onClick={onOpenHistory}
          >
            履歴を見る
          </button>
        </p>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn btn--block"
          onClick={() => setPanel(panel === 'split' ? 'none' : 'split')}
        >
          <IconSplit size={18} />
          このPDFを分割する
        </button>
      </div>

      {panel === 'compress' ? (
        <div style={{ marginTop: 18 }}>
          <Field label="圧縮後の画質" hint="ページを再生成してファイルサイズを小さくします">
            <SegmentedControl<QualityId>
              ariaLabel="圧縮後の画質"
              value={compressQuality}
              onChange={setCompressQuality}
              options={QUALITIES.map((quality) => ({
                id: quality.id,
                label: quality.label,
                hint: quality.hint,
              }))}
            />
          </Field>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              setPanel('none');
              onCompress(compressQuality);
            }}
          >
            この画質で圧縮する
          </button>
        </div>
      ) : null}

      {panel === 'split' ? (
        <div style={{ marginTop: 18 }}>
          <Field label="分割方法">
            <SegmentedControl<'ranges' | 'every' | 'single'>
              ariaLabel="分割方法"
              value={splitMode}
              onChange={(mode) => {
                setSplitMode(mode);
                setSplitValue(mode === 'every' ? '2' : '1');
              }}
              options={[
                { id: 'ranges', label: '範囲指定' },
                { id: 'every', label: 'Nページごと' },
                { id: 'single', label: '1ページずつ' },
              ]}
            />
          </Field>

          {splitMode !== 'single' ? (
            <Field
              label={splitMode === 'ranges' ? 'ページ範囲' : '区切るページ数'}
              hint={
                splitMode === 'ranges'
                  ? `例: 1-3, 5, 8-10（全${result.pageCount}ページ）`
                  : '指定したページ数ごとにファイルを分けます'
              }
            >
              <input
                className="text-input"
                type={splitMode === 'every' ? 'number' : 'text'}
                min={1}
                max={result.pageCount}
                value={splitValue}
                onChange={(event) => setSplitValue(event.target.value)}
                placeholder={splitMode === 'ranges' ? '1-3, 5' : '2'}
                aria-label={splitMode === 'ranges' ? 'ページ範囲' : '区切るページ数'}
              />
            </Field>
          ) : (
            <p className="muted">全 {result.pageCount} ページを 1 ページずつのファイルに分割します。</p>
          )}

          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              setPanel('none');
              onSplit(splitMode, splitValue);
            }}
          >
            分割する
          </button>
          <p className="field__hint">2 ファイル以上になる場合は ZIP でまとめて保存します。</p>
        </div>
      ) : null}
    </Sheet>
  );
}
