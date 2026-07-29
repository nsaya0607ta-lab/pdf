/**
 * アプリ状態の Context。
 * 状態と dispatch を分離して提供し、不要な再レンダリングを抑える。
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { DEFAULT_PDF_SETTINGS } from '../constants';
import { loadPreferences, savePreferences } from '../lib/storage';
import { appReducer, type AppAction, type AppState } from './appReducer';

function createInitialState(): AppState {
  // 「最近使った設定」を復元する
  const preferences = loadPreferences();
  return {
    pages: [],
    selectedIds: [],
    selectionMode: false,
    settings: { ...DEFAULT_PDF_SETTINGS, ...preferences.pdf },
    enhanceDefaults: preferences.enhance,
    autoEnhanceEnabled: preferences.autoEnhanceEnabled,
    theme: preferences.theme,
    sort: { key: null, direction: 'asc' },
    result: null,
    history: [],
    keepHistory: preferences.keepHistory,
    toasts: [],
  };
}

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<AppAction> | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  // 設定が変わるたびに永続化する（PDF 名は毎回変わるので保存しない）
  useEffect(() => {
    savePreferences({
      pdf: {
        paperSize: state.settings.paperSize,
        orientation: state.settings.orientation,
        margin: state.settings.margin,
        quality: state.settings.quality,
        searchableText: state.settings.searchableText,
      },
      enhance: state.enhanceDefaults,
      autoEnhanceEnabled: state.autoEnhanceEnabled,
      theme: state.theme,
      keepHistory: state.keepHistory,
    });
  }, [
    state.settings,
    state.enhanceDefaults,
    state.autoEnhanceEnabled,
    state.theme,
    state.keepHistory,
  ]);

  const memoState = useMemo(() => state, [state]);

  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={memoState}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (!state) throw new Error('AppProvider の外側で useAppState が呼ばれました');
  return state;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('AppProvider の外側で useAppDispatch が呼ばれました');
  return dispatch;
}
