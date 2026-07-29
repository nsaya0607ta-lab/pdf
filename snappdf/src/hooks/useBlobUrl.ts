import { useEffect, useState } from 'react';

/**
 * Blob から表示用の ObjectURL を作り、不要になったら解放するフック。
 * 解放を忘れるとメモリリークになるため、この 1 か所にまとめている。
 */
export function useBlobUrl(blob: Blob | undefined | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return url;
}
