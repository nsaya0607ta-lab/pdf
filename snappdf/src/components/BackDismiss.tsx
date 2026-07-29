import { useBackDismiss } from '../hooks/useBackDismiss';

/**
 * 端末の戻る操作を 1 段階ぶん受け取るための部品（表示なし）。
 *
 * フックは条件付きで呼べないため、
 * 「戻る操作を受け取りたいときだけマウントする」形にしている。
 */
export function BackDismiss({ onBack }: { onBack: () => void }) {
  useBackDismiss(onBack);
  return null;
}
