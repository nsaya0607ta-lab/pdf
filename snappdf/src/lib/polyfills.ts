/**
 * 互換性のためのポリフィル。
 *
 * pdf.js の新しいバージョンは提案段階の `Map.prototype.getOrInsertComputed` を
 * 使用しており、これに未対応のブラウザ（多くの現行ブラウザ・iOS Safari を含む）では
 * PDF の読み込み時に例外が発生する。
 * 影響範囲が小さく副作用のない実装なので、アプリ起動時に補っておく。
 *
 * 同じ理由で pdf.js のワーカーファイルにも同等のコードを埋め込んでいる
 * （scripts/prepare-assets.mjs を参照）。
 */

type MapLike = {
  has(key: unknown): boolean;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): unknown;
};

export function installPolyfills(): void {
  for (const ctor of [Map, WeakMap] as unknown as Array<{ prototype: Record<string, unknown> }>) {
    const proto = ctor?.prototype;
    if (!proto) continue;

    if (typeof proto['getOrInsert'] !== 'function') {
      proto['getOrInsert'] = function (this: MapLike, key: unknown, value: unknown) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      };
    }
    if (typeof proto['getOrInsertComputed'] !== 'function') {
      proto['getOrInsertComputed'] = function (
        this: MapLike,
        key: unknown,
        callback: (key: unknown) => unknown,
      ) {
        if (!this.has(key)) this.set(key, callback(key));
        return this.get(key);
      };
    }
  }
}
