/**
 * 設定の永続化（最近使った設定の記憶）。
 * localStorage が使えない環境（プライベートブラウズ等）でも
 * アプリが動き続けるよう、すべて try/catch で保護する。
 */

import { DEFAULT_ENHANCE, DEFAULT_PDF_SETTINGS, PREFERENCES_STORAGE_KEY } from '../constants';
import type { PersistedPreferences } from '../types';

export const DEFAULT_PREFERENCES: PersistedPreferences = {
  pdf: {
    paperSize: DEFAULT_PDF_SETTINGS.paperSize,
    orientation: DEFAULT_PDF_SETTINGS.orientation,
    margin: DEFAULT_PDF_SETTINGS.margin,
    quality: DEFAULT_PDF_SETTINGS.quality,
    searchableText: DEFAULT_PDF_SETTINGS.searchableText,
  },
  enhance: DEFAULT_ENHANCE,
  autoEnhanceEnabled: true,
  theme: 'system',
  keepHistory: true,
};

/** 保存済み設定を読み込む（壊れていれば既定値） */
export function loadPreferences(): PersistedPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<PersistedPreferences>;
    return {
      pdf: { ...DEFAULT_PREFERENCES.pdf, ...(parsed.pdf ?? {}) },
      enhance: { ...DEFAULT_PREFERENCES.enhance, ...(parsed.enhance ?? {}) },
      autoEnhanceEnabled: parsed.autoEnhanceEnabled ?? DEFAULT_PREFERENCES.autoEnhanceEnabled,
      theme: parsed.theme ?? DEFAULT_PREFERENCES.theme,
      keepHistory: parsed.keepHistory ?? DEFAULT_PREFERENCES.keepHistory,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** 設定を保存する（失敗しても無視） */
export function savePreferences(preferences: PersistedPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // 容量制限やプライベートブラウズでは保存できないが、動作に支障はない
  }
}
