/**
 * アプリのルートコンポーネント。
 *
 * 画面遷移を最小限にするため、一覧を中心に据えて
 * 各機能はシート（モーダル）で重ねる構成にしている。
 *   ①取り込み → ②並び替え → ③編集 → ④PDF設定 → ⑤作成 → ⑥保存・共有
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackDismiss } from './components/BackDismiss';
import { EmptyState } from './components/EmptyState';
import { HistorySheet } from './components/HistorySheet';
import { Lightbox } from './components/Lightbox';
import { PageEditor } from './components/PageEditor';
import { PageGrid } from './components/PageGrid';
import { ProgressOverlay } from './components/ProgressOverlay';
import { ResultSheet } from './components/ResultSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { Toasts } from './components/Toasts';
import { MenuItem, PopoverMenu } from './components/ui';
import {
  IconArrowLeft,
  IconCheck,
  IconDocument,
  IconHistory,
  IconImages,
  IconMoon,
  IconMore,
  IconPlus,
  IconSettings,
  IconSort,
  IconSun,
  IconText,
  IconTrash,
} from './components/icons';
import { ACCEPT_ATTRIBUTE, MAX_PAGES, QUALITIES } from './constants';
import { useJob } from './hooks/useJob';
import { useTheme } from './hooks/useTheme';
import { addHistory, clearHistory, loadHistory, removeHistory } from './lib/history';
import { importFiles } from './lib/importFiles';
import { runOcr } from './lib/ocr';
import { resolveEnhance, sourceSize } from './lib/pageUtils';
import { compressPdf } from './lib/pdf/compress';
import { chunkRanges, parseRanges, splitPdf } from './lib/pdf/split';
import { buildPdfViaWorker, renderViaWorker } from './lib/pipelineClient';
import { downloadBlob, printPdf, shareFile } from './lib/share';
import { releaseThumbnails } from './lib/thumbnails';
import { createZip } from './lib/zip';
import { formatBytes, sanitizeFileName } from './lib/util';
import { useAppDispatch, useAppState } from './store/AppContext';
import type { BuildPageSpec, HistoryEntry, PageItem, QualityId, SortKey } from './types';
import { MARGINS, PAPER_SIZES } from './constants';

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  useTheme(state.theme);

  const notify = useCallback(
    (message: string, tone: 'info' | 'success' | 'error' = 'info') => {
      dispatch({ type: 'toast/push', message, tone });
    },
    [dispatch],
  );

  const job = useJob((message) => notify(message, 'error'));

  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /**
   * 表示中の画面。
   * 'home'  … 取り込み画面（ホーム）
   * 'pages' … ページ一覧
   * ページを読み込んでもホームへ戻れるよう、一覧とホームを行き来できるようにしている。
   */
  const [view, setView] = useState<'home' | 'pages'>('home');
  const [dragActive, setDragActive] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editorPageId, setEditorPageId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  const editorPage = state.pages.find((page) => page.id === editorPageId) ?? null;
  const editorIndex = state.pages.findIndex((page) => page.id === editorPageId);
  const hasOcr = state.pages.some((page) => page.ocr);

  // 起動時に保存済みの履歴を読み込む
  useEffect(() => {
    let cancelled = false;
    loadHistory()
      .then((entries) => {
        if (!cancelled && entries.length > 0) {
          dispatch({ type: 'history/set', entries });
        }
      })
      .catch(() => {
        /* 履歴が読めなくてもアプリは使える */
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /* ------------------------------ 取り込み ------------------------------ */

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const remaining = MAX_PAGES - state.pages.length;
      if (remaining <= 0) {
        notify(`ページ数が上限（${MAX_PAGES}枚）に達しています`, 'error');
        return;
      }

      await job.run('画像を読み込み中', async (signal, update) => {
        const result = await importFiles(files, {
          remaining,
          quality: state.settings.quality,
          signal,
          onProgress: ({ done, total, label }) => {
            update({ ratio: total > 0 ? done / total : null, detail: label });
          },
        });

        if (result.pages.length > 0) {
          dispatch({ type: 'pages/add', pages: result.pages });
          // 取り込んだらページ一覧へ切り替える
          setView('pages');
        }
        if (result.skippedByLimit > 0) {
          notify(`上限のため ${result.skippedByLimit} 件は追加できませんでした`, 'error');
        }
        for (const error of result.errors.slice(0, 3)) {
          notify(`${error.name}: ${error.reason}`, 'error');
        }
        if (result.pages.length > 0) {
          notify(`${result.pages.length} ページを追加しました`, 'success');
        }
        return result;
      });
    },
    [dispatch, job, notify, state.pages.length, state.settings.quality],
  );

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      // 同じファイルを続けて選べるように値をリセットする
      event.target.value = '';
      void handleFiles(files);
    },
    [handleFiles],
  );

  // ウィンドウ全体でドラッグ＆ドロップを受け付ける
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      depth += 1;
      setDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      depth = 0;
      setDragActive(false);
      void handleFiles(Array.from(event.dataTransfer.files));
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFiles]);

  // ページが 1 枚もなくなったらホームへ戻す
  useEffect(() => {
    if (state.pages.length === 0) setView('home');
  }, [state.pages.length]);

  // 作業中の離脱を警告する
  useEffect(() => {
    if (state.pages.length === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.pages.length]);

  /* ------------------------------ ページ操作 ------------------------------ */

  const handleDelete = useCallback(
    (id: string) => {
      releaseThumbnails(id);
      dispatch({ type: 'pages/remove', ids: [id] });
    },
    [dispatch],
  );

  const handleDeleteSelected = useCallback(() => {
    if (state.selectedIds.length === 0) return;
    for (const id of state.selectedIds) releaseThumbnails(id);
    dispatch({ type: 'pages/remove', ids: state.selectedIds });
    notify(`${state.selectedIds.length} ページを削除しました`, 'success');
  }, [dispatch, notify, state.selectedIds]);

  const handleSort = useCallback(
    (key: SortKey) => {
      const direction =
        state.sort.key === key && state.sort.direction === 'asc' ? 'desc' : 'asc';
      dispatch({ type: 'pages/sort', key, direction });
      setSortMenuOpen(false);
      const labels: Record<SortKey, string> = {
        name: '名前順',
        lastModified: '更新日時順',
        capturedAt: '撮影日時順',
      };
      notify(`${labels[key]}（${direction === 'asc' ? '昇順' : '降順'}）に並び替えました`);
    },
    [dispatch, notify, state.sort],
  );

  /* -------------------------------- OCR -------------------------------- */

  const handleOcr = useCallback(
    async (targets: PageItem[]) => {
      if (targets.length === 0) {
        notify('OCR するページがありません');
        return;
      }
      await job.run('文字を認識中', async (signal, update) => {
        let index = 0;
        for (const page of targets) {
          if (signal.aborted) break;
          update({
            ratio: index / targets.length,
            detail: `${index + 1} / ${targets.length} ページ`,
          });
          const ocr = await runOcr(page, {
            signal,
            defaultEnhance: state.enhanceDefaults,
            autoEnhanceEnabled: state.autoEnhanceEnabled,
            onProgress: (ratio) => {
              update({ ratio: (index + ratio) / targets.length });
            },
          });
          dispatch({ type: 'pages/setOcr', id: page.id, ocr });
          index += 1;
        }
        if (!signal.aborted) {
          dispatch({ type: 'settings/patch', patch: { searchableText: true } });
          notify(`${index} ページの文字を認識しました`, 'success');
        }
        return index;
      });
    },
    [dispatch, job, notify, state.autoEnhanceEnabled, state.enhanceDefaults],
  );

  /* ------------------------------ PDF 作成 ------------------------------ */

  const buildSpecs = useCallback((): BuildPageSpec[] => {
    const preset = QUALITIES.find((q) => q.id === state.settings.quality) ?? QUALITIES[1];
    return state.pages.map((page) => {
      const size = sourceSize(page);
      const spec: BuildPageSpec = {
        id: page.id,
        blob: page.blob,
        rotation: page.rotation,
        enhance: resolveEnhance(page, state.enhanceDefaults, state.autoEnhanceEnabled),
        maxEdge: preset?.maxEdge ?? 2339,
        jpegQuality: preset?.jpegQuality ?? 0.82,
        sourceWidth: size.width,
        sourceHeight: size.height,
      };
      if (page.crop) spec.crop = page.crop;
      if (state.settings.searchableText && page.ocr) spec.ocr = page.ocr;
      return spec;
    });
  }, [state.autoEnhanceEnabled, state.enhanceDefaults, state.pages, state.settings]);

  /** 履歴一覧に出す 1 ページ目のサムネイルを作る（失敗しても致命的ではない） */
  const createThumbnail = useCallback(async (specs: BuildPageSpec[]): Promise<Blob | undefined> => {
    const first = specs[0];
    if (!first) return undefined;
    try {
      const rendered = await renderViaWorker({ ...first, maxEdge: 280, jpegQuality: 0.7 });
      return rendered.blob;
    } catch {
      return undefined;
    }
  }, []);

  /** 作成した PDF を履歴へ保存する */
  const saveToHistory = useCallback(
    async (entry: Omit<HistoryEntry, 'id'>) => {
      if (!state.keepHistory) return;
      try {
        const entries = await addHistory(entry, state.history);
        dispatch({ type: 'history/set', entries });
      } catch {
        notify('履歴に保存できませんでした（端末の空き容量をご確認ください）', 'error');
      }
    },
    [dispatch, notify, state.history, state.keepHistory],
  );

  const handleCreatePdf = useCallback(async () => {
    if (state.pages.length === 0) return;
    const fileName = `${sanitizeFileName(state.settings.fileName || 'scan')}.pdf`;
    const specs = buildSpecs();

    const built = await job.run('PDF を作成中', async (signal, update) => {
      const result = await buildPdfViaWorker(
        { pages: specs, settings: state.settings },
        {
          signal,
          onProgress: (done, total, label) => {
            update({
              ratio: total > 0 ? done / total : null,
              detail: `${Math.min(done, total)} / ${total} ページ`,
              ...(label ? { label } : {}),
            });
          },
        },
      );
      return result;
    });

    if (!built) return;
    const blob = new Blob([built.bytes as unknown as BlobPart], { type: 'application/pdf' });
    const thumbnail = await createThumbnail(specs);
    const createdAt = Date.now();

    dispatch({
      type: 'result/set',
      result: {
        blob,
        fileName,
        pageCount: built.pageCount,
        byteSize: blob.size,
        createdAt,
        quality: state.settings.quality,
        ...(thumbnail ? { thumbnail } : {}),
      },
    });
    setShowResult(true);
    notify(`${built.pageCount} ページの PDF を作成しました（${formatBytes(blob.size)}）`, 'success');

    void saveToHistory({
      fileName,
      pageCount: built.pageCount,
      byteSize: blob.size,
      createdAt,
      quality: state.settings.quality,
      blob,
      ...(thumbnail ? { thumbnail } : {}),
    });
  }, [
    buildSpecs,
    createThumbnail,
    dispatch,
    job,
    notify,
    saveToHistory,
    state.pages.length,
    state.settings,
  ]);

  /* ----------------------------- 圧縮・分割 ----------------------------- */

  const handleCompress = useCallback(
    async (quality: QualityId) => {
      const result = state.result;
      if (!result) return;

      const compressed = await job.run('PDF を圧縮中', async (signal, update) => {
        const bytes = await result.blob.arrayBuffer();
        return compressPdf(bytes, {
          quality,
          fileName: result.fileName.replace(/\.pdf$/i, ''),
          signal,
          onProgress: (done, total, label) => {
            update({ ratio: total > 0 ? done / total : null, label, detail: `${done} / ${total}` });
          },
        });
      });

      if (!compressed) return;
      const blob = new Blob([compressed.bytes as unknown as BlobPart], { type: 'application/pdf' });
      const saved = result.byteSize - blob.size;
      const createdAt = Date.now();
      dispatch({
        type: 'result/set',
        result: {
          blob,
          fileName: result.fileName,
          pageCount: compressed.pageCount,
          byteSize: blob.size,
          createdAt,
          quality,
          ...(result.thumbnail ? { thumbnail: result.thumbnail } : {}),
        },
      });
      notify(
        saved > 0
          ? `${formatBytes(saved)} 削減しました（${formatBytes(blob.size)}）`
          : `圧縮しました（${formatBytes(blob.size)}）`,
        'success',
      );

      // 圧縮後のファイルも履歴に残す（元のファイルも履歴から取り出せる）
      void saveToHistory({
        fileName: result.fileName,
        pageCount: compressed.pageCount,
        byteSize: blob.size,
        createdAt,
        quality,
        blob,
        ...(result.thumbnail ? { thumbnail: result.thumbnail } : {}),
      });
    },
    [dispatch, job, notify, saveToHistory, state.result],
  );

  const handleSplit = useCallback(
    async (mode: 'ranges' | 'every' | 'single', value: string) => {
      const result = state.result;
      if (!result) return;

      const ranges =
        mode === 'ranges'
          ? parseRanges(value, result.pageCount)
          : mode === 'every'
            ? chunkRanges(result.pageCount, Number(value) || 1)
            : chunkRanges(result.pageCount, 1);

      if (ranges.length === 0) {
        notify('ページ範囲を認識できませんでした（例: 1-3, 5）', 'error');
        return;
      }

      const parts = await job.run(
        'PDF を分割中',
        async (signal, update) => {
          update({ ratio: null, detail: `${ranges.length} ファイルに分割します` });
          const bytes = await result.blob.arrayBuffer();
          if (signal.aborted) return null;
          return splitPdf(bytes, ranges, result.fileName.replace(/\.pdf$/i, ''));
        },
        { cancellable: false },
      );

      if (!parts || parts.length === 0) return;
      if (parts.length === 1) {
        const part = parts[0];
        if (!part) return;
        downloadBlob(
          new Blob([part.bytes as unknown as BlobPart], { type: 'application/pdf' }),
          part.name,
        );
      } else {
        const zip = createZip(parts.map((part) => ({ name: part.name, data: part.bytes })));
        downloadBlob(zip, `${result.fileName.replace(/\.pdf$/i, '')}_分割.zip`);
      }
      notify(`${parts.length} 個のファイルに分割しました`, 'success');
    },
    [job, notify, state.result],
  );

  /* ------------------------------- 出力 ------------------------------- */

  const saveBlob = useCallback(
    (blob: Blob, fileName: string) => {
      downloadBlob(blob, fileName);
      notify('PDF を保存しました', 'success');
    },
    [notify],
  );

  const shareBlob = useCallback(
    async (blob: Blob, fileName: string) => {
      const shared = await shareFile(blob, fileName, fileName);
      if (!shared) notify('共有できませんでした。保存してからお試しください', 'error');
    },
    [notify],
  );

  const handleSave = useCallback(() => {
    if (!state.result) return;
    saveBlob(state.result.blob, state.result.fileName);
  }, [saveBlob, state.result]);

  const handleShare = useCallback(async () => {
    if (!state.result) return;
    await shareBlob(state.result.blob, state.result.fileName);
  }, [shareBlob, state.result]);

  const handlePrint = useCallback(() => {
    if (!state.result) return;
    printPdf(state.result.blob);
  }, [state.result]);

  /* ------------------------------- 履歴 ------------------------------- */

  const handleHistoryDelete = useCallback(
    async (entry: HistoryEntry) => {
      await removeHistory(entry.id);
      dispatch({ type: 'history/remove', id: entry.id });
      notify('履歴から削除しました', 'success');
    },
    [dispatch, notify],
  );

  const handleHistoryClear = useCallback(async () => {
    await clearHistory();
    dispatch({ type: 'history/clear' });
    notify('履歴を削除しました', 'success');
  }, [dispatch, notify]);

  /** 履歴の PDF をページとして読み込み、編集し直せるようにする */
  const handleHistoryReuse = useCallback(
    async (entry: HistoryEntry) => {
      setShowHistory(false);
      const file = new File([entry.blob], entry.fileName, { type: 'application/pdf' });
      await handleFiles([file]);
    },
    [handleFiles],
  );

  /* ------------------------------ 表示補助 ------------------------------ */

  const summary = useMemo(() => {
    const paper = PAPER_SIZES.find((p) => p.id === state.settings.paperSize)?.label ?? '';
    const quality = QUALITIES.find((q) => q.id === state.settings.quality)?.label ?? '';
    const margin = MARGINS.find((m) => m.id === state.settings.margin)?.label ?? '';
    const orientation =
      state.settings.orientation === 'portrait'
        ? '縦'
        : state.settings.orientation === 'landscape'
          ? '横'
          : '自動';
    return `${paper}・${orientation}・余白${margin}・${quality}`;
  }, [state.settings]);

  const totalBytes = useMemo(
    () => state.pages.reduce((sum, page) => sum + page.byteSize, 0),
    [state.pages],
  );

  return (
    <div className="app">
      <header className="header">
        {view === 'pages' ? (
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => setView('home')}
            aria-label="ホームに戻る"
            title="ホームに戻る"
          >
            <IconArrowLeft />
          </button>
        ) : null}
        <div className="header__brand">
          <span className="header__logo">
            <IconDocument size={17} />
          </span>
          <span className="header__name">SnapPDF</span>
        </div>
        {state.pages.length > 0 ? (
          <span className="header__count">
            {state.pages.length} / {MAX_PAGES} 枚
          </span>
        ) : null}
        <span className="header__spacer" />
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => setShowHistory(true)}
          aria-label="作成したPDFの履歴"
          title="作成したPDFの履歴"
        >
          <IconHistory />
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() =>
            dispatch({ type: 'theme/set', theme: state.theme === 'dark' ? 'light' : 'dark' })
          }
          aria-label={state.theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
          title="ダークモード切り替え"
        >
          {state.theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => setShowSettings(true)}
          aria-label="PDF 設定"
        >
          <IconSettings />
        </button>
      </header>

      <main className="app__main">
        {view === 'home' || state.pages.length === 0 ? (
          <EmptyState
            dragActive={dragActive}
            recent={state.history}
            pendingPages={state.pages.length}
            onResume={() => setView('pages')}
            onPickPhotos={() => photoInputRef.current?.click()}
            onPickFiles={() => fileInputRef.current?.click()}
            onOpenCamera={() => cameraInputRef.current?.click()}
            onOpenHistory={() => setShowHistory(true)}
          />
        ) : (
          <>
            <div className="toolbar">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => photoInputRef.current?.click()}
                disabled={state.pages.length >= MAX_PAGES}
              >
                <IconPlus size={18} />
                画像を追加
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSortMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={sortMenuOpen}
                >
                  <IconSort size={18} />
                  並び替え
                </button>
                {sortMenuOpen ? (
                  <PopoverMenu onClose={() => setSortMenuOpen(false)} align="left">
                    <div className="menu__label">一括並び替え</div>
                    <MenuItem
                      onClick={() => handleSort('name')}
                      checked={state.sort.key === 'name'}
                    >
                      名前順
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleSort('lastModified')}
                      checked={state.sort.key === 'lastModified'}
                    >
                      更新日時順
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleSort('capturedAt')}
                      checked={state.sort.key === 'capturedAt'}
                    >
                      撮影日時順
                    </MenuItem>
                    <div className="menu__sep" />
                    <MenuItem
                      onClick={() => {
                        dispatch({ type: 'pages/reverse' });
                        setSortMenuOpen(false);
                      }}
                    >
                      現在の並びを逆順にする
                    </MenuItem>
                  </PopoverMenu>
                ) : null}
              </div>

              <button
                type="button"
                className={`btn${state.selectionMode ? ' btn--primary' : ''}`}
                onClick={() =>
                  dispatch({ type: 'selection/setMode', enabled: !state.selectionMode })
                }
              >
                <IconCheck size={18} />
                {state.selectionMode ? '選択を終了' : '選択'}
              </button>

              {state.selectionMode ? (
                <>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => dispatch({ type: 'selection/all' })}
                  >
                    すべて選択
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={handleDeleteSelected}
                    disabled={state.selectedIds.length === 0}
                  >
                    <IconTrash size={16} />
                    {state.selectedIds.length} 件を削除
                  </button>
                </>
              ) : null}

              <span className="toolbar__spacer" />

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => setToolsMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={toolsMenuOpen}
                  aria-label="ツール"
                >
                  <IconMore />
                </button>
                {toolsMenuOpen ? (
                  <PopoverMenu onClose={() => setToolsMenuOpen(false)}>
                    <div className="menu__label">ツール</div>
                    <MenuItem
                      icon={<IconDocument size={16} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      PDF・ファイルを結合
                    </MenuItem>
                    <MenuItem
                      icon={<IconImages size={16} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        cameraInputRef.current?.click();
                      }}
                    >
                      カメラで撮影して追加
                    </MenuItem>
                    <MenuItem
                      icon={<IconText size={16} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        void handleOcr(state.pages.filter((page) => !page.ocr));
                      }}
                    >
                      未処理ページを OCR
                    </MenuItem>
                    <div className="menu__sep" />
                    <MenuItem
                      danger
                      icon={<IconTrash size={16} />}
                      onClick={() => {
                        setToolsMenuOpen(false);
                        if (window.confirm('すべてのページを削除しますか？')) {
                          for (const page of state.pages) releaseThumbnails(page.id);
                          dispatch({ type: 'pages/clear' });
                        }
                      }}
                    >
                      すべて削除
                    </MenuItem>
                  </PopoverMenu>
                ) : null}
              </div>
            </div>

            <PageGrid
              pages={state.pages}
              selectionMode={state.selectionMode}
              selectedIds={state.selectedIds}
              enhanceDefaults={state.enhanceDefaults}
              autoEnhanceEnabled={state.autoEnhanceEnabled}
              onReorder={(from, to) => dispatch({ type: 'pages/move', from, to })}
              onOpen={(index) => setLightboxIndex(index)}
              onEdit={(id) => setEditorPageId(id)}
              onDelete={handleDelete}
              onDuplicate={(id) => dispatch({ type: 'pages/duplicate', id })}
              onToggleSelect={(id) => dispatch({ type: 'selection/toggle', id })}
            />
          </>
        )}
      </main>

      {/* ページ一覧を見ているときは、端末の戻る操作でもホームへ戻す */}
      {view === 'pages' ? <BackDismiss onBack={() => setView('home')} /> : null}

      {view === 'pages' && state.pages.length > 0 ? (
        <footer className="footer">
          <div className="footer__inner">
            <div className="footer__summary">
              <span className="footer__title">
                {sanitizeFileName(state.settings.fileName || 'scan')}.pdf
              </span>
              <span className="footer__meta">
                {state.pages.length} ページ・{summary}・元画像 {formatBytes(totalBytes)}
              </span>
            </div>
            <button type="button" className="btn" onClick={() => setShowSettings(true)}>
              <IconSettings size={18} />
              設定
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => void handleCreatePdf()}
              disabled={job.busy}
            >
              PDF を作成
            </button>
          </div>
        </footer>
      ) : null}

      {/* ファイル選択用の非表示 input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={onInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="sr-only"
        onChange={onInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {dragActive ? (
        <div className="drop-overlay">
          <div className="drop-overlay__inner">ここにドロップして追加</div>
        </div>
      ) : null}

      {lightboxIndex !== null && state.pages.length > 0 ? (
        <Lightbox
          pages={state.pages}
          index={Math.min(lightboxIndex, state.pages.length - 1)}
          enhanceDefaults={state.enhanceDefaults}
          autoEnhanceEnabled={state.autoEnhanceEnabled}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onEdit={(id) => {
            setLightboxIndex(null);
            setEditorPageId(id);
          }}
        />
      ) : null}

      {editorPage ? (
        <PageEditor
          page={editorPage}
          index={editorIndex}
          total={state.pages.length}
          enhanceDefaults={state.enhanceDefaults}
          autoEnhanceEnabled={state.autoEnhanceEnabled}
          ocrBusy={job.busy}
          onPatch={(id, patch) => dispatch({ type: 'pages/update', id, patch })}
          onDuplicate={(id) => {
            dispatch({ type: 'pages/duplicate', id });
            notify('ページを複製しました', 'success');
          }}
          onDelete={handleDelete}
          onRunOcr={(page) => void handleOcr([page])}
          onClose={() => setEditorPageId(null)}
        />
      ) : null}

      {showSettings ? (
        <SettingsSheet
          settings={state.settings}
          enhanceDefaults={state.enhanceDefaults}
          autoEnhanceEnabled={state.autoEnhanceEnabled}
          hasOcr={hasOcr}
          onPatch={(patch) => dispatch({ type: 'settings/patch', patch })}
          onEnhancePatch={(patch) => dispatch({ type: 'enhance/setDefaults', patch })}
          onAutoEnhanceToggle={(enabled) => dispatch({ type: 'enhance/setEnabled', enabled })}
          onClose={() => setShowSettings(false)}
        />
      ) : null}

      {showResult && state.result ? (
        <ResultSheet
          result={state.result}
          keepHistory={state.keepHistory}
          onOpenHistory={() => {
            setShowResult(false);
            setShowHistory(true);
          }}
          onSave={handleSave}
          onShare={() => void handleShare()}
          onPrint={handlePrint}
          onCompress={(quality) => void handleCompress(quality)}
          onSplit={(mode, value) => void handleSplit(mode, value)}
          onClose={() => setShowResult(false)}
        />
      ) : null}

      {showHistory ? (
        <HistorySheet
          entries={state.history}
          keepHistory={state.keepHistory}
          onKeepHistoryChange={(enabled) => dispatch({ type: 'history/setEnabled', enabled })}
          onSave={(entry) => saveBlob(entry.blob, entry.fileName)}
          onShare={(entry) => void shareBlob(entry.blob, entry.fileName)}
          onPrint={(entry) => printPdf(entry.blob)}
          onReuse={(entry) => void handleHistoryReuse(entry)}
          onDelete={(entry) => void handleHistoryDelete(entry)}
          onClearAll={() => void handleHistoryClear()}
          onClose={() => setShowHistory(false)}
        />
      ) : null}

      {job.progress ? <ProgressOverlay progress={job.progress} onCancel={job.cancel} /> : null}

      <Toasts
        toasts={state.toasts}
        onDismiss={(id) => dispatch({ type: 'toast/dismiss', id })}
      />
    </div>
  );
}
