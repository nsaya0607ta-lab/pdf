/**
 * アプリ状態の reducer。
 * 副作用を持たない純粋関数として実装しているため、状態遷移を追跡・テストしやすい。
 */

import { MAX_PAGES } from '../constants';
import { duplicatePage, moveItem, sortPages } from '../lib/pageUtils';
import { createId } from '../lib/util';
import type {
  EnhanceOptions,
  GeneratedPdf,
  HistoryEntry,
  OcrResult,
  PageItem,
  PdfSettings,
  SortDirection,
  SortKey,
  ThemeMode,
  Toast,
} from '../types';

export interface AppState {
  pages: PageItem[];
  /** 選択モードで選ばれているページ ID */
  selectedIds: string[];
  /** 複数選択モードかどうか */
  selectionMode: boolean;
  settings: PdfSettings;
  /** 自動補正のグローバル既定値 */
  enhanceDefaults: EnhanceOptions;
  autoEnhanceEnabled: boolean;
  theme: ThemeMode;
  /** 直近の並び替え条件（key が null なら未実施） */
  sort: { key: SortKey | null; direction: SortDirection };
  result: GeneratedPdf | null;
  /** 作成済み PDF の履歴（新しい順） */
  history: HistoryEntry[];
  /** 履歴を端末に保存するか */
  keepHistory: boolean;
  toasts: Toast[];
}

export type AppAction =
  | { type: 'pages/add'; pages: PageItem[] }
  | { type: 'pages/remove'; ids: string[] }
  | { type: 'pages/move'; from: number; to: number }
  | { type: 'pages/sort'; key: SortKey; direction: SortDirection }
  | { type: 'pages/reverse' }
  | { type: 'pages/update'; id: string; patch: Partial<PageItem> }
  | { type: 'pages/duplicate'; id: string }
  | { type: 'pages/setOcr'; id: string; ocr: OcrResult }
  | { type: 'pages/clear' }
  | { type: 'selection/toggle'; id: string }
  | { type: 'selection/setMode'; enabled: boolean }
  | { type: 'selection/all' }
  | { type: 'selection/clear' }
  | { type: 'settings/patch'; patch: Partial<PdfSettings> }
  | { type: 'enhance/setDefaults'; patch: Partial<EnhanceOptions> }
  | { type: 'enhance/setEnabled'; enabled: boolean }
  | { type: 'theme/set'; theme: ThemeMode }
  | { type: 'result/set'; result: GeneratedPdf | null }
  | { type: 'history/set'; entries: HistoryEntry[] }
  | { type: 'history/remove'; id: string }
  | { type: 'history/clear' }
  | { type: 'history/setEnabled'; enabled: boolean }
  | { type: 'toast/push'; message: string; tone: Toast['tone'] }
  | { type: 'toast/dismiss'; id: string };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'pages/add': {
      const room = MAX_PAGES - state.pages.length;
      const accepted = action.pages.slice(0, Math.max(0, room));
      const overflow = action.pages.length - accepted.length;
      const next: AppState = { ...state, pages: [...state.pages, ...accepted] };
      if (overflow > 0) {
        return pushToast(
          next,
          `最大${MAX_PAGES}枚までのため、${overflow}枚は追加されませんでした`,
          'error',
        );
      }
      return next;
    }

    case 'pages/remove': {
      const ids = new Set(action.ids);
      return {
        ...state,
        pages: state.pages.filter((page) => !ids.has(page.id)),
        selectedIds: state.selectedIds.filter((id) => !ids.has(id)),
      };
    }

    case 'pages/move':
      return { ...state, pages: moveItem(state.pages, action.from, action.to) };

    case 'pages/sort':
      return {
        ...state,
        pages: sortPages(state.pages, action.key, action.direction),
        sort: { key: action.key, direction: action.direction },
      };

    case 'pages/reverse':
      return { ...state, pages: state.pages.slice().reverse() };

    case 'pages/update':
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === action.id ? { ...page, ...action.patch } : page,
        ),
      };

    case 'pages/duplicate': {
      const index = state.pages.findIndex((page) => page.id === action.id);
      if (index < 0) return state;
      if (state.pages.length >= MAX_PAGES) {
        return pushToast(state, `最大${MAX_PAGES}枚までです`, 'error');
      }
      const source = state.pages[index] as PageItem;
      const pages = state.pages.slice();
      pages.splice(index + 1, 0, duplicatePage(source));
      return { ...state, pages };
    }

    case 'pages/setOcr':
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === action.id ? { ...page, ocr: action.ocr } : page,
        ),
      };

    case 'pages/clear':
      return { ...state, pages: [], selectedIds: [], selectionMode: false, result: null };

    case 'selection/toggle': {
      const exists = state.selectedIds.includes(action.id);
      return {
        ...state,
        selectedIds: exists
          ? state.selectedIds.filter((id) => id !== action.id)
          : [...state.selectedIds, action.id],
      };
    }

    case 'selection/setMode':
      return {
        ...state,
        selectionMode: action.enabled,
        selectedIds: action.enabled ? state.selectedIds : [],
      };

    case 'selection/all':
      return { ...state, selectedIds: state.pages.map((page) => page.id) };

    case 'selection/clear':
      return { ...state, selectedIds: [] };

    case 'settings/patch':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'enhance/setDefaults':
      return { ...state, enhanceDefaults: { ...state.enhanceDefaults, ...action.patch } };

    case 'enhance/setEnabled':
      return { ...state, autoEnhanceEnabled: action.enabled };

    case 'theme/set':
      return { ...state, theme: action.theme };

    case 'result/set':
      return { ...state, result: action.result };

    case 'history/set':
      return { ...state, history: action.entries };

    case 'history/remove':
      return { ...state, history: state.history.filter((entry) => entry.id !== action.id) };

    case 'history/clear':
      return { ...state, history: [] };

    case 'history/setEnabled':
      return { ...state, keepHistory: action.enabled };

    case 'toast/push':
      return pushToast(state, action.message, action.tone);

    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };

    default:
      return state;
  }
}

function pushToast(state: AppState, message: string, tone: Toast['tone']): AppState {
  const toast: Toast = { id: createId('toast'), message, tone };
  // 同時表示は 2 件までに制限（画面を覆いすぎないように）
  return { ...state, toasts: [...state.toasts, toast].slice(-2) };
}
