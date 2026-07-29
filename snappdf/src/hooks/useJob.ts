import { useCallback, useRef, useState } from 'react';
import type { ProgressState } from '../types';
import { CancelledError, toMessage } from '../lib/util';

export interface JobController {
  progress: ProgressState | null;
  busy: boolean;
  /** 進捗表示を更新する */
  update: (patch: Partial<ProgressState>) => void;
  /** 非同期処理を進捗表示付きで実行する */
  run: <T>(
    label: string,
    task: (signal: AbortSignal, update: (patch: Partial<ProgressState>) => void) => Promise<T>,
    options?: { cancellable?: boolean },
  ) => Promise<T | null>;
  cancel: () => void;
}

/**
 * 進捗表示・キャンセルを共通化するフック。
 * 同時に 1 つの重い処理だけを走らせることで、メモリ使用量の急増を防ぐ。
 */
export function useJob(onError?: (message: string) => void): JobController {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const update = useCallback((patch: Partial<ProgressState>) => {
    setProgress((current) =>
      current ? { ...current, ...patch } : { label: '', ratio: null, cancellable: true, ...patch },
    );
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    update({ label: 'キャンセルしています…', ratio: null, cancellable: false });
  }, [update]);

  const run = useCallback(
    async <T,>(
      label: string,
      task: (signal: AbortSignal, updateFn: (patch: Partial<ProgressState>) => void) => Promise<T>,
      options?: { cancellable?: boolean },
    ): Promise<T | null> => {
      if (runningRef.current) {
        onError?.('別の処理を実行中です。完了までお待ちください');
        return null;
      }
      runningRef.current = true;
      const controller = new AbortController();
      controllerRef.current = controller;
      setProgress({ label, ratio: null, cancellable: options?.cancellable ?? true });

      try {
        return await task(controller.signal, update);
      } catch (error) {
        if (error instanceof CancelledError || controller.signal.aborted) {
          return null;
        }
        onError?.(toMessage(error));
        return null;
      } finally {
        runningRef.current = false;
        controllerRef.current = null;
        setProgress(null);
      }
    },
    [onError, update],
  );

  return { progress, busy: progress !== null, update, run, cancel };
}
