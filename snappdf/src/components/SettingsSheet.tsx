/**
 * PDF 設定シート。
 * 用紙サイズ・向き・余白・画質・ファイル名・自動補正をまとめて設定する。
 * 設定内容は自動的に保存され、次回起動時に復元される。
 */

import { MARGINS, ORIENTATIONS, PAPER_SIZES, QUALITIES } from '../constants';
import type {
  EnhanceOptions,
  MarginId,
  Orientation,
  PaperSizeId,
  PdfSettings,
  QualityId,
} from '../types';
import { Field, SegmentedControl, Sheet, SwitchRow } from './ui';

interface SettingsSheetProps {
  settings: PdfSettings;
  enhanceDefaults: EnhanceOptions;
  autoEnhanceEnabled: boolean;
  hasOcr: boolean;
  onPatch: (patch: Partial<PdfSettings>) => void;
  onEnhancePatch: (patch: Partial<EnhanceOptions>) => void;
  onAutoEnhanceToggle: (enabled: boolean) => void;
  onClose: () => void;
}

export function SettingsSheet({
  settings,
  enhanceDefaults,
  autoEnhanceEnabled,
  hasOcr,
  onPatch,
  onEnhancePatch,
  onAutoEnhanceToggle,
  onClose,
}: SettingsSheetProps) {
  return (
    <Sheet
      title="PDF 設定"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onClose}>
          完了
        </button>
      }
    >
      <Field label="ファイル名">
        <input
          className="text-input"
          type="text"
          value={settings.fileName}
          onChange={(event) => onPatch({ fileName: event.target.value })}
          placeholder="scan"
          aria-label="PDF のファイル名"
          enterKeyHint="done"
        />
        <p className="field__hint">拡張子（.pdf）は自動で付きます</p>
      </Field>

      <Field label="用紙サイズ">
        <SegmentedControl<PaperSizeId>
          ariaLabel="用紙サイズ"
          value={settings.paperSize}
          onChange={(paperSize) => onPatch({ paperSize })}
          options={PAPER_SIZES.map((paper) => ({
            id: paper.id,
            label: paper.label,
            hint: paper.hint,
          }))}
        />
      </Field>

      <Field
        label="向き"
        hint={
          settings.paperSize === 'original'
            ? '「元画像サイズ」では画像の向きがそのまま使われます'
            : '「自動」は画像の縦横比に合わせて 1 ページごとに切り替えます'
        }
      >
        <SegmentedControl<Orientation>
          ariaLabel="用紙の向き"
          value={settings.orientation}
          onChange={(orientation) => onPatch({ orientation })}
          options={ORIENTATIONS.map((item) => ({ id: item.id, label: item.label }))}
        />
      </Field>

      <Field label="余白">
        <SegmentedControl<MarginId>
          ariaLabel="余白"
          value={settings.margin}
          onChange={(margin) => onPatch({ margin })}
          options={MARGINS.map((item) => ({
            id: item.id,
            label: item.label,
            hint: item.mm > 0 ? `${item.mm}mm` : '0mm',
          }))}
        />
      </Field>

      <Field label="画質">
        <SegmentedControl<QualityId>
          ariaLabel="画質"
          value={settings.quality}
          onChange={(quality) => onPatch({ quality })}
          options={QUALITIES.map((item) => ({
            id: item.id,
            label: item.label,
            hint: item.hint,
          }))}
        />
      </Field>

      <Field label="自動補正" hint="取り込んだ画像に自動で適用されます（ページごとに変更も可能）">
        <div className="stack" style={{ gap: 0 }}>
          <SwitchRow
            title="自動補正を使う"
            description="オフにすると元画像のまま PDF 化します"
            checked={autoEnhanceEnabled}
            onChange={onAutoEnhanceToggle}
          />
          <SwitchRow
            title="傾き補正"
            checked={enhanceDefaults.deskew}
            disabled={!autoEnhanceEnabled}
            onChange={(checked) => onEnhancePatch({ deskew: checked })}
          />
          <SwitchRow
            title="明るさ補正"
            checked={enhanceDefaults.brightness}
            disabled={!autoEnhanceEnabled}
            onChange={(checked) => onEnhancePatch({ brightness: checked })}
          />
          <SwitchRow
            title="コントラスト補正"
            checked={enhanceDefaults.contrast}
            disabled={!autoEnhanceEnabled}
            onChange={(checked) => onEnhancePatch({ contrast: checked })}
          />
          <SwitchRow
            title="白黒スキャン化"
            description="書類のコピーに最適。写真には不向きです"
            checked={enhanceDefaults.monochrome}
            disabled={!autoEnhanceEnabled}
            onChange={(checked) => onEnhancePatch({ monochrome: checked })}
          />
        </div>
      </Field>

      <Field
        label="検索可能 PDF"
        hint={
          hasOcr
            ? 'OCR 済みページに不可視のテキスト層を埋め込みます'
            : 'まず「ツール」から OCR を実行してください'
        }
      >
        <SwitchRow
          title="OCR テキストを埋め込む"
          description="PDF 内の文字を検索・コピーできるようになります"
          checked={settings.searchableText}
          disabled={!hasOcr}
          onChange={(checked) => onPatch({ searchableText: checked })}
        />
      </Field>
    </Sheet>
  );
}
