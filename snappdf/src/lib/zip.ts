/**
 * 最小構成の ZIP 書き出し（無圧縮 / STORE 方式）。
 *
 * 分割した複数の PDF を一括ダウンロードするために使用する。
 * PDF 自体が既に圧縮済みなので、無圧縮でもサイズはほぼ変わらない。
 * 外部ライブラリを追加せずに済むよう自前実装している。
 */

/** CRC32 テーブル（初回利用時に生成） */
let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ (table[(crc ^ (data[i] as number)) & 0xff] as number);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** DOS 形式の日時に変換する */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

/** ZIP アーカイブ（無圧縮）を生成する */
export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const now = dosDateTime(new Date());
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // --- ローカルファイルヘッダー ---
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // flags: UTF-8 file name
    local.setUint16(8, 0, true); // method: store
    local.setUint16(10, now.time, true);
    local.setUint16(12, now.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    localParts.push(local.buffer as ArrayBuffer, nameBytes, entry.data as unknown as BlobPart);

    // --- セントラルディレクトリ ---
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, now.time, true);
    central.setUint16(14, now.date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, offset, true);
    centralParts.push(central.buffer as ArrayBuffer, nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralSize = centralParts.reduce(
    (sum, part) => sum + (part instanceof ArrayBuffer ? part.byteLength : (part as Uint8Array).length),
    0,
  );

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, end.buffer as ArrayBuffer], {
    type: 'application/zip',
  });
}
