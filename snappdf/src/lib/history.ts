/**
 * 作成した PDF の履歴。
 *
 * PDF 本体とサムネイルを IndexedDB に保存し、アプリを閉じても残るようにする。
 * 保存先は端末内のみで、外部へは一切送信しない。
 * 容量を圧迫しないよう、件数と合計サイズの上限を超えたら古いものから削除する。
 */

import { dbClear, dbDelete, dbGetAll, dbPut, isStorageAvailable } from './db';
import type { HistoryEntry } from '../types';
import { createId } from './util';

/** 保持する最大件数 */
export const HISTORY_MAX_ENTRIES = 30;
/** 保持する合計サイズの上限（バイト） */
export const HISTORY_MAX_BYTES = 300 * 1024 * 1024;

/** 履歴を新しい順で取得する */
export async function loadHistory(): Promise<HistoryEntry[]> {
  if (!isStorageAvailable()) return [];
  try {
    const entries = await dbGetAll<HistoryEntry>();
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/**
 * 履歴へ追加する。
 * @returns 追加後の履歴一覧（古いものを削除した結果を反映）
 */
export async function addHistory(
  entry: Omit<HistoryEntry, 'id'>,
  existing: HistoryEntry[],
): Promise<HistoryEntry[]> {
  const record: HistoryEntry = { ...entry, id: createId('pdf') };
  if (!isStorageAvailable()) return [record, ...existing];

  try {
    await dbPut(record);
  } catch {
    // 保存できなくてもアプリの動作は継続する（メモリ上には残る）
    return [record, ...existing];
  }

  const merged = [record, ...existing];
  return pruneHistory(merged);
}

/** 上限を超えた古い履歴を削除する */
async function pruneHistory(entries: HistoryEntry[]): Promise<HistoryEntry[]> {
  const kept: HistoryEntry[] = [];
  const removed: HistoryEntry[] = [];
  let total = 0;

  for (const entry of entries) {
    total += entry.byteSize;
    if (kept.length < HISTORY_MAX_ENTRIES && total <= HISTORY_MAX_BYTES) {
      kept.push(entry);
    } else {
      removed.push(entry);
    }
  }

  for (const entry of removed) {
    try {
      await dbDelete(entry.id);
    } catch {
      /* 削除に失敗しても表示上は除外する */
    }
  }
  return kept;
}

/** 1 件削除する */
export async function removeHistory(id: string): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    await dbDelete(id);
  } catch {
    /* 失敗しても表示からは消す */
  }
}

/** すべて削除する */
export async function clearHistory(): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    await dbClear();
  } catch {
    /* 失敗しても表示からは消す */
  }
}
