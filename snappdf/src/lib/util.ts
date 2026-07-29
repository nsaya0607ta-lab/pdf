/** 汎用ユーティリティ */

/** 衝突しにくい短い ID を生成する */
export function createId(prefix = 'id'): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `${prefix}_${cryptoObj.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** バイト数を人間が読める文字列にする */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** 日時を「2026/07/29 12:34」形式にする */
export function formatDateTime(ms: number | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 重い同期処理の合間に UI へ制御を戻す。
 * scheduler.yield() が使える環境ではそれを利用し、無ければ setTimeout(0) にフォールバック。
 */
export function yieldToUi(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler && typeof scheduler.yield === 'function') {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** ファイル名として使えない文字を除去する */
export function sanitizeFileName(name: string, fallback = 'document'): string {
  const cleaned = name
    // ファイル名に使えない記号と制御文字を除去する
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
}

/** 拡張子を除いたファイル名 */
export function stripExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

/** 数値の自然順ソート込みで文字列を比較する（"img2" < "img10"） */
const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

/** AbortSignal を Promise 化して、キャンセル時に reject させる */
export class CancelledError extends Error {
  constructor() {
    super('処理がキャンセルされました');
    this.name = 'CancelledError';
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError();
}

/** エラーオブジェクトから表示用メッセージを取り出す */
export function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '不明なエラーが発生しました';
}
