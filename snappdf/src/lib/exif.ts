/**
 * 最小構成の EXIF リーダー。
 *
 * 目的は「撮影日時（DateTimeOriginal）」の取得のみ。
 * 画像の向きは createImageBitmap(blob, { imageOrientation: 'from-image' }) が
 * デコード時に適用するため、ここでは扱わない。
 *
 * 外部ライブラリを使わず、JPEG の APP1(Exif) セグメントだけを解析する。
 */

const APP1_MARKER = 0xffe1;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD_POINTER = 0x8769;

/** JPEG 先頭から最大何バイトまで走査するか（EXIF は通常先頭 64KB 以内） */
const MAX_SCAN_BYTES = 256 * 1024;

/**
 * 画像ファイルから撮影日時（ミリ秒）を取得する。
 * 取得できない場合は undefined を返す（例外は投げない）。
 */
export async function readCapturedAt(file: Blob): Promise<number | undefined> {
  try {
    if (file.type && !/jpe?g|tiff/i.test(file.type)) return undefined;
    const head = await file.slice(0, Math.min(file.size, MAX_SCAN_BYTES)).arrayBuffer();
    const view = new DataView(head);
    const exifOffset = findExifSegment(view);
    if (exifOffset < 0) return undefined;
    return parseExif(view, exifOffset);
  } catch {
    return undefined;
  }
}

/** APP1(Exif) セグメントの TIFF ヘッダー開始位置を返す。見つからなければ -1 */
function findExifSegment(view: DataView): number {
  if (view.byteLength < 4) return -1;
  // TIFF ファイルがそのまま渡された場合
  const bom = view.getUint16(0, false);
  if (bom === 0x4949 || bom === 0x4d4d) return 0;
  if (view.getUint16(0, false) !== 0xffd8) return -1; // SOI ではない

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    if ((marker & 0xff00) !== 0xff00) return -1;
    const length = view.getUint16(offset + 2, false);
    if (marker === APP1_MARKER) {
      const headerStart = offset + 4;
      // "Exif\0\0"
      if (
        headerStart + 6 <= view.byteLength &&
        view.getUint32(headerStart, false) === 0x45786966 &&
        view.getUint16(headerStart + 4, false) === 0x0000
      ) {
        return headerStart + 6;
      }
    }
    if (marker === 0xffda) return -1; // 画像データ開始
    offset += 2 + length;
  }
  return -1;
}

/** TIFF ヘッダーを解析して日時タグを探す */
function parseExif(view: DataView, tiffStart: number): number | undefined {
  if (tiffStart + 8 > view.byteLength) return undefined;
  const endianMark = view.getUint16(tiffStart, false);
  const littleEndian = endianMark === 0x4949;
  if (!littleEndian && endianMark !== 0x4d4d) return undefined;
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return undefined;

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0 = tiffStart + ifd0Offset;
  const candidates: Array<{ tag: number; value: string }> = [];

  const exifIfdPointer = readIfd(view, tiffStart, ifd0, littleEndian, candidates);
  if (exifIfdPointer !== undefined) {
    readIfd(view, tiffStart, tiffStart + exifIfdPointer, littleEndian, candidates);
  }

  // 優先度: DateTimeOriginal > DateTimeDigitized > DateTime
  for (const tag of [TAG_DATETIME_ORIGINAL, TAG_DATETIME_DIGITIZED, TAG_DATETIME]) {
    const hit = candidates.find((c) => c.tag === tag);
    if (hit) {
      const ms = parseExifDate(hit.value);
      if (ms !== undefined) return ms;
    }
  }
  return undefined;
}

/**
 * 1 つの IFD を読み取り、日時系タグを candidates に積む。
 * Exif IFD へのポインタが見つかればその値を返す。
 */
function readIfd(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  littleEndian: boolean,
  candidates: Array<{ tag: number; value: string }>,
): number | undefined {
  if (ifdStart + 2 > view.byteLength) return undefined;
  const entryCount = view.getUint16(ifdStart, littleEndian);
  let exifPointer: number | undefined;

  for (let i = 0; i < entryCount; i += 1) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const count = view.getUint32(entry + 4, littleEndian);

    if (tag === TAG_EXIF_IFD_POINTER && type === 4) {
      exifPointer = view.getUint32(entry + 8, littleEndian);
      continue;
    }
    if (type !== 2) continue; // ASCII 以外は対象外
    if (tag !== TAG_DATETIME_ORIGINAL && tag !== TAG_DATETIME_DIGITIZED && tag !== TAG_DATETIME) {
      continue;
    }
    const valueOffset = count > 4 ? tiffStart + view.getUint32(entry + 8, littleEndian) : entry + 8;
    if (valueOffset + count > view.byteLength) continue;
    let text = '';
    for (let j = 0; j < count; j += 1) {
      const code = view.getUint8(valueOffset + j);
      if (code === 0) break;
      text += String.fromCharCode(code);
    }
    candidates.push({ tag, value: text });
  }
  return exifPointer;
}

/** "2026:07:29 12:34:56" 形式をミリ秒に変換する（ローカルタイム扱い） */
function parseExifDate(value: string): number | undefined {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  const ms = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  ).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}
