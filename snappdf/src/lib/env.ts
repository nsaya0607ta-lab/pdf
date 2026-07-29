/**
 * ビルド環境差分の吸収。
 * Vite では import.meta.env が注入されるが、
 * 他のバンドラ／テスト環境では存在しないことがあるため安全に読み出す。
 */

type ViteEnv = Record<string, string | undefined> & { BASE_URL?: string };

function readEnv(): ViteEnv {
  try {
    return ((import.meta as unknown as { env?: ViteEnv }).env ?? {}) as ViteEnv;
  } catch {
    return {};
  }
}

const env = readEnv();

/** 公開ディレクトリ（public/）のベース URL */
export const BASE_URL = env.BASE_URL ?? './';

/** public/ に置かれた静的ファイルの URL を組み立てる */
export function assetUrl(path: string): string {
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  return new URL(`${base}${path}`, self.location.href).href;
}

/** 環境変数を読み出す（未定義なら fallback） */
export function envVar(name: string, fallback: string): string {
  const value = env[name];
  return value && value.length > 0 ? value : fallback;
}

export const IS_PRODUCTION = env['MODE'] === 'production' || env['PROD'] === 'true';
