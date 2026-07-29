import { useEffect, useRef } from 'react';

/**
 * 端末の「戻る」操作でシートやプレビューを閉じられるようにするフック。
 *
 * 仕組み:
 *  - 表示時に履歴エントリを 1 つ積み、popstate を受け取ったら閉じる
 *  - 画面内のボタンで閉じた場合は、積んだエントリを取り除いて履歴を元に戻す
 *
 * 重要なのは「重なって表示されている場合に、一番手前のものだけが反応する」こと。
 * 各コンポーネントが個別に popstate を購読すると、1 回の戻る操作で
 * シートも背後の画面も同時に戻ってしまうため、
 * モジュール内で 1 つのスタックとリスナーを共有して制御している。
 */

interface StackEntry {
  handler: () => unknown;
  /** 戻る操作で既に閉じられたか（クリーンアップ時の二重処理を防ぐ） */
  dismissed: boolean;
}

const stack: StackEntry[] = [];
/**
 * 自分で呼んだ history.back() の完了待ちフラグ。
 * back() は非同期なので、完了前に pushState すると
 * 積んだばかりのエントリが消されてしまう。
 * そのため待機中の push は queuedPushes に貯めておき、完了後にまとめて積む。
 */
let pendingBack = false;
let queuedPushes = 0;
let listening = false;

function pushHistoryEntry(): void {
  if (pendingBack) {
    queuedPushes += 1;
    return;
  }
  window.history.pushState({ snapPdfOverlay: true }, '');
}

function handlePopState(): void {
  // 自分が呼んだ back() の結果なら、閉じる処理は行わない
  if (pendingBack) {
    pendingBack = false;
    while (queuedPushes > 0) {
      queuedPushes -= 1;
      window.history.pushState({ snapPdfOverlay: true }, '');
    }
    return;
  }

  const entry = stack[stack.length - 1];
  if (!entry) return;

  // true が返った場合は「閉じずに 1 段階戻っただけ」。履歴エントリを積み直す。
  const stayedOpen = entry.handler() === true;
  if (stayedOpen) {
    pushHistoryEntry();
    return;
  }
  entry.dismissed = true;
  stack.pop();
}

/**
 * popstate の購読はアプリ内で 1 つだけ持ち、解除しない。
 * （解除してしまうと、クリーンアップで呼んだ history.back() の
 *   popstate を受け取れず、待機フラグが戻らなくなる）
 */
function startListening(): void {
  if (listening) return;
  window.addEventListener('popstate', handlePopState);
  listening = true;
}

/**
 * @param onClose 戻る操作で呼ばれる処理。
 *                true を返すと「閉じずに戻っただけ」として扱われる。
 */
export function useBackDismiss(onClose: () => unknown): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;

    const entry: StackEntry = {
      handler: () => onCloseRef.current(),
      dismissed: false,
    };
    stack.push(entry);
    pushHistoryEntry();
    startListening();

    return () => {
      const index = stack.indexOf(entry);
      if (index >= 0) stack.splice(index, 1);

      // 画面内のボタンで閉じた場合だけ、自分が積んだ履歴エントリを取り除く。
      // このとき発生する popstate は他のシートに反応させない。
      if (!entry.dismissed) {
        if (queuedPushes > 0) {
          // まだ実際には積まれていない分を取り消すだけでよい
          queuedPushes -= 1;
        } else if (!pendingBack) {
          pendingBack = true;
          window.history.back();
        }
      }
    };
  }, []);
}
