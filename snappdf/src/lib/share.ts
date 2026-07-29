/**
 * 出力（保存・共有・印刷）。
 * iOS / Android / デスクトップでの挙動差を吸収する。
 */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 少し待ってから解放しないと Safari でダウンロードが中断されることがある
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Web Share API（ファイル共有）が使えるか */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
  try {
    const probe = new File([new Blob(['test'])], 'probe.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * 他アプリへ共有する（iOS/Android の共有シート）。
 * @returns 共有できた場合 true。非対応・キャンセル時は false。
 */
export async function shareFile(blob: Blob, fileName: string, title: string): Promise<boolean> {
  if (!canShareFiles()) return false;
  const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
  try {
    await navigator.share({ files: [file], title, text: title });
    return true;
  } catch (error) {
    // ユーザーがキャンセルした場合も例外になるため、エラー扱いにはしない
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    return false;
  }
}

/**
 * PDF を印刷する。
 * 非表示 iframe に読み込んで print() を呼ぶ。
 * iOS Safari は iframe 印刷に制限があるため、その場合は新規タブで開く。
 */
export function printPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);

  if (isIos) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
  };
  document.body.appendChild(iframe);

  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
