/**
 * アプリ全体で共有する型定義。
 * UI・画像処理・PDF生成の各レイヤーはすべてこの型を介してやり取りする。
 */

/** 回転角度（時計回り・度数法） */
export type Rotation = 0 | 90 | 180 | 270;

/** 正規化トリミング領域（0〜1 の相対座標。EXIF 補正後の画像に対する比率） */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 自動補正の設定（グローバル既定値／ページ個別上書きの両方で使用） */
export interface EnhanceOptions {
  /** 傾き補正（文書のスキュー角を推定して水平化） */
  deskew: boolean;
  /** 明るさ自動補正（ヒストグラムの下位側を持ち上げる） */
  brightness: boolean;
  /** コントラスト自動補正（ヒストグラムストレッチ） */
  contrast: boolean;
  /** 白黒スキャン化（適応的二値化） */
  monochrome: boolean;
}

/** OCR で認識した単語 1 件（座標は EXIF/回転/トリミング適用後の画像ピクセル） */
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** OCR 結果 */
export interface OcrResult {
  text: string;
  words: OcrWord[];
  /** OCR 実行時に基準とした画像サイズ（座標のスケール変換に使用） */
  imageWidth: number;
  imageHeight: number;
  updatedAt: number;
}

/** ページ（＝ PDF の 1 ページになる 1 枚の画像）*/
export interface PageItem {
  id: string;
  /** 表示名（元ファイル名） */
  name: string;
  /** 取り込み元。'pdf' は既存 PDF をラスタライズして取り込んだページ */
  origin: 'image' | 'pdf';
  /** 元画像のバイト列。処理は常にここから再生成する（非破壊編集） */
  blob: Blob;
  mimeType: string;
  /** 元画像の実寸（EXIF 回転適用後） */
  naturalWidth: number;
  naturalHeight: number;
  byteSize: number;
  /** ファイル更新日時（ミリ秒） */
  lastModified: number;
  /** EXIF の撮影日時（ミリ秒）。取得できない場合は undefined */
  capturedAt?: number;
  /** ユーザー操作による回転 */
  rotation: Rotation;
  /** トリミング領域。undefined なら全面 */
  crop?: CropRect;
  /** 自動補正のページ個別設定。undefined ならグローバル設定に従う */
  enhance?: EnhanceOptions;
  /** OCR 結果（未実行なら undefined） */
  ocr?: OcrResult;
}

/** 用紙サイズ */
export type PaperSizeId = 'a4' | 'a3' | 'b5' | 'letter' | 'original';
/** 用紙の向き */
export type Orientation = 'portrait' | 'landscape' | 'auto';
/** 余白 */
export type MarginId = 'none' | 'small' | 'medium' | 'large';
/** 画質 */
export type QualityId = 'high' | 'standard' | 'light';

/** PDF 生成設定 */
export interface PdfSettings {
  paperSize: PaperSizeId;
  orientation: Orientation;
  margin: MarginId;
  quality: QualityId;
  /** 出力ファイル名（拡張子なし） */
  fileName: string;
  /** OCR テキストを不可視レイヤーとして埋め込み、検索可能 PDF にする */
  searchableText: boolean;
}

/** 記憶しておく設定（localStorage に保存） */
export interface PersistedPreferences {
  pdf: Omit<PdfSettings, 'fileName'>;
  enhance: EnhanceOptions;
  autoEnhanceEnabled: boolean;
  theme: ThemeMode;
  /** 作成した PDF を端末に履歴として残すか */
  keepHistory: boolean;
}

export type ThemeMode = 'system' | 'light' | 'dark';

/** 並び替えキー */
export type SortKey = 'name' | 'lastModified' | 'capturedAt';
export type SortDirection = 'asc' | 'desc';

/** 進捗表示用の状態 */
export interface ProgressState {
  /** 実行中のジョブ名（日本語表示用） */
  label: string;
  /** 0〜1。不定の場合は null */
  ratio: number | null;
  /** 補足テキスト（例: 「12 / 100 ページ」） */
  detail?: string;
  /** キャンセル可能かどうか */
  cancellable: boolean;
}

/** 生成済み PDF */
export interface GeneratedPdf {
  blob: Blob;
  fileName: string;
  pageCount: number;
  byteSize: number;
  createdAt: number;
  /** どの画質で生成したか（再圧縮 UI の初期値に使う） */
  quality: QualityId;
  /** 1 ページ目のサムネイル（履歴表示に流用する） */
  thumbnail?: Blob;
}

/** 作成した PDF の履歴 1 件（IndexedDB に保存される） */
export interface HistoryEntry {
  id: string;
  fileName: string;
  pageCount: number;
  byteSize: number;
  createdAt: number;
  quality: QualityId;
  /** PDF 本体 */
  blob: Blob;
  /** 1 ページ目のサムネイル（一覧表示用） */
  thumbnail?: Blob;
}

/** トースト通知 */
export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

/* ------------------------------------------------------------------ *
 * Worker とのメッセージプロトコル
 * ------------------------------------------------------------------ */

/** Worker へ渡すページ 1 件分の描画指示（Blob は構造化クローンで転送される） */
export interface RenderSpec {
  id: string;
  blob: Blob;
  rotation: Rotation;
  crop?: CropRect;
  enhance: EnhanceOptions;
  /** 長辺の最大ピクセル数 */
  maxEdge: number;
  /** JPEG 品質（0〜1） */
  jpegQuality: number;
}

/** PDF 組み立て時の 1 ページ分の指示 */
export interface BuildPageSpec extends RenderSpec {
  ocr?: OcrResult;
  /** トリミング・回転適用後の元解像度（用紙サイズ「元画像サイズ」の計算に使用） */
  sourceWidth: number;
  sourceHeight: number;
}

export interface BuildPdfRequest {
  pages: BuildPageSpec[];
  settings: PdfSettings;
  /** 先頭に結合する既存 PDF のバイト列（PDF 結合機能） */
  mergeHeadPdf?: ArrayBuffer;
  /** 末尾に結合する既存 PDF のバイト列 */
  mergeTailPdf?: ArrayBuffer;
  /** 日本語対応フォント（検索可能 PDF 用・任意） */
  jpFont?: ArrayBuffer;
}

export type WorkerRequest =
  | { type: 'render'; jobId: string; spec: RenderSpec }
  | { type: 'buildPdf'; jobId: string; payload: BuildPdfRequest }
  | { type: 'cancel'; jobId: string };

export type WorkerResponse =
  | { type: 'progress'; jobId: string; done: number; total: number; label?: string }
  | { type: 'render'; jobId: string; blob: Blob; width: number; height: number }
  | { type: 'buildPdf'; jobId: string; bytes: ArrayBuffer; pageCount: number }
  | { type: 'error'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string };
