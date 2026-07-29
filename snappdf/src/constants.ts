import { envVar } from './lib/env';
import type {
  EnhanceOptions,
  MarginId,
  Orientation,
  PaperSizeId,
  PdfSettings,
  QualityId,
} from './types';

/** 取り込める画像の最大枚数 */
export const MAX_PAGES = 100;

/** 1 pt = 1/72 inch。mm → pt 変換係数 */
export const MM_TO_PT = 72 / 25.4;

export interface PaperDefinition {
  id: PaperSizeId;
  label: string;
  /** 縦向きにしたときの [幅, 高さ]（pt）。'original' は null */
  size: readonly [number, number] | null;
  hint: string;
}

/**
 * 用紙サイズ定義（縦向き基準・単位 pt）
 * B5 は日本で一般的な JIS B5（182 × 257 mm）を採用。
 */
export const PAPER_SIZES: readonly PaperDefinition[] = [
  { id: 'a4', label: 'A4', size: [210 * MM_TO_PT, 297 * MM_TO_PT], hint: '210 × 297 mm' },
  { id: 'a3', label: 'A3', size: [297 * MM_TO_PT, 420 * MM_TO_PT], hint: '297 × 420 mm' },
  { id: 'b5', label: 'B5', size: [182 * MM_TO_PT, 257 * MM_TO_PT], hint: 'JIS 182 × 257 mm' },
  { id: 'letter', label: 'Letter', size: [612, 792], hint: '8.5 × 11 inch' },
  { id: 'original', label: '元画像サイズ', size: null, hint: '画像の縦横比そのまま' },
] as const;

export const ORIENTATIONS: readonly { id: Orientation; label: string }[] = [
  { id: 'portrait', label: '縦' },
  { id: 'landscape', label: '横' },
  { id: 'auto', label: '自動' },
] as const;

/** 余白（mm） */
export const MARGINS: readonly { id: MarginId; label: string; mm: number }[] = [
  { id: 'none', label: 'なし', mm: 0 },
  { id: 'small', label: '小', mm: 5 },
  { id: 'medium', label: '中', mm: 10 },
  { id: 'large', label: '大', mm: 20 },
] as const;

export interface QualityDefinition {
  id: QualityId;
  label: string;
  /** 長辺の最大ピクセル数 */
  maxEdge: number;
  /** JPEG 圧縮品質 */
  jpegQuality: number;
  hint: string;
}

/**
 * 画質プリセット。
 * A4 相当で 高画質≒300dpi / 標準≒200dpi / 軽量≒120dpi を目安にしている。
 */
export const QUALITIES: readonly QualityDefinition[] = [
  { id: 'high', label: '高画質', maxEdge: 3508, jpegQuality: 0.92, hint: '約300dpi・印刷向け' },
  { id: 'standard', label: '標準', maxEdge: 2339, jpegQuality: 0.82, hint: '約200dpi・おすすめ' },
  { id: 'light', label: '軽量', maxEdge: 1400, jpegQuality: 0.68, hint: '約120dpi・共有向け' },
] as const;

/** サムネイルの長辺サイズ（px） */
export const THUMBNAIL_MAX_EDGE = 360;
/** 拡大プレビューの長辺サイズ（px） */
export const PREVIEW_MAX_EDGE = 1600;
/** OCR に渡す画像の長辺サイズ（px）。大きすぎると極端に遅くなる */
export const OCR_MAX_EDGE = 1800;

export const DEFAULT_ENHANCE: EnhanceOptions = {
  deskew: true,
  brightness: true,
  contrast: true,
  monochrome: false,
};

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  paperSize: 'a4',
  orientation: 'auto',
  margin: 'none',
  quality: 'standard',
  fileName: 'scan',
  searchableText: false,
};

/** 対応する画像 MIME タイプ */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/bmp',
  'image/avif',
] as const;

export const ACCEPT_ATTRIBUTE = 'image/*,application/pdf';

/** localStorage のキー */
export const PREFERENCES_STORAGE_KEY = 'snap-pdf:preferences:v1';

/**
 * Tesseract.js の読み込み元。
 * 既定では CDN から動的読み込みする（バンドルサイズを増やさないため）。
 * `npm i tesseract.js` 済みの環境では .env で以下を差し替えられる:
 *   VITE_TESSERACT_URL=/node_modules/tesseract.js/dist/tesseract.esm.min.js
 */
export const TESSERACT_MODULE_URL = envVar(
  'VITE_TESSERACT_URL',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js',
);

/** OCR 言語（日本語 + 英語） */
export const OCR_LANGUAGES = 'jpn+eng';
