/** 一時的な通知（トースト）。数秒で自動的に消える。 */

import { useEffect } from 'react';
import type { Toast } from '../types';

interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  // 一定時間で自動的に消える（操作を妨げないようボタンは置かない）
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.tone === 'error' ? 5500 : 3000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <span className="toast__dot" />
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  );
}
