/**
 * IndexedDB の最小ラッパー。
 *
 * 作成した PDF を端末内に保存しておくために使用する（外部送信は一切しない）。
 * ライブラリを追加せずに済むよう、必要な操作だけを薄く実装している。
 */

const DB_NAME = 'snap-pdf';
const DB_VERSION = 1;
export const HISTORY_STORE = 'history';

let dbPromise: Promise<IDBDatabase> | null = null;

/** IndexedDB が使えるか（プライベートブラウズ等では使えないことがある） */
export function isStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('データベースを開けませんでした'));
    request.onblocked = () => reject(new Error('データベースが他のタブで使用中です'));
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

/** 1 件のトランザクションを Promise 化する */
function runTransaction<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE, mode);
        const store = transaction.objectStore(HISTORY_STORE);
        let result: T | undefined;
        const request = handler(store);
        if (request) {
          request.onsuccess = () => {
            result = request.result;
          };
        }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error ?? new Error('保存に失敗しました'));
        transaction.onabort = () => reject(transaction.error ?? new Error('保存が中断されました'));
      }),
  );
}

export function dbPut<T>(value: T): Promise<unknown> {
  return runTransaction('readwrite', (store) => store.put(value as unknown as object));
}

export function dbGetAll<T>(): Promise<T[]> {
  return runTransaction<T[]>('readonly', (store) => store.getAll() as IDBRequest<T[]>).then(
    (rows) => rows ?? [],
  );
}

export function dbDelete(id: string): Promise<unknown> {
  return runTransaction('readwrite', (store) => {
    store.delete(id);
    return null;
  });
}

export function dbClear(): Promise<unknown> {
  return runTransaction('readwrite', (store) => {
    store.clear();
    return null;
  });
}
