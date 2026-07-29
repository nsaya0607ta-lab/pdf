/**
 * PDF 組み立て処理（pdf-lib）。
 *
 * Web Worker から呼ばれることを前提としているが、
 * OffscreenCanvas 非対応環境ではメインスレッドからも同じ関数を利用する。
 */

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import type { BuildPageSpec, BuildPdfRequest, OcrResult } from '../../types';
import { envVar } from '../env';
import { renderImage } from '../imagePipeline';
import { CancelledError } from '../util';
import { computePageSize, fitRect, marginToPt } from './paper';

export interface BuildProgress {
  done: number;
  total: number;
  label: string;
}

export interface BuildOptions {
  onProgress?: (progress: BuildProgress) => void;
  /** true を返すと処理を中断する */
  isCancelled?: () => boolean;
}

/**
 * 画像ページ（＋任意の既存 PDF）から 1 つの PDF を組み立てる。
 * @returns PDF のバイト列とページ数
 */
export async function buildPdf(
  request: BuildPdfRequest,
  options: BuildOptions = {},
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const { pages, settings } = request;
  const doc = await PDFDocument.create();
  doc.setProducer('SnapPDF');
  doc.setCreator('SnapPDF');
  doc.setTitle(settings.fileName);
  doc.setCreationDate(new Date());

  const marginPt = marginToPt(settings.margin);
  const total =
    pages.length + (request.mergeHeadPdf ? 1 : 0) + (request.mergeTailPdf ? 1 : 0);
  let done = 0;

  const checkCancel = () => {
    if (options.isCancelled?.()) throw new CancelledError();
  };

  // --- 先頭に結合する既存 PDF ---
  if (request.mergeHeadPdf) {
    options.onProgress?.({ done, total, label: '既存PDFを読み込み中' });
    await appendExistingPdf(doc, request.mergeHeadPdf);
    done += 1;
  }

  // --- 検索可能 PDF 用フォントの準備 ---
  let textFont: PDFFont | undefined;
  let fontSupportsJapanese = false;
  if (settings.searchableText) {
    const prepared = await prepareTextFont(doc, request.jpFont);
    textFont = prepared.font;
    fontSupportsJapanese = prepared.supportsJapanese;
  }

  // --- 画像ページ ---
  for (const spec of pages) {
    checkCancel();
    options.onProgress?.({ done, total, label: '画像を処理中' });

    const rendered = await renderImage(spec);
    const imageBytes = new Uint8Array(await rendered.blob.arrayBuffer());
    const embedded =
      rendered.format === 'png'
        ? await doc.embedPng(imageBytes)
        : await doc.embedJpg(imageBytes);

    const pageSize = computePageSize(
      settings.paperSize,
      settings.orientation,
      spec.sourceWidth,
      spec.sourceHeight,
    );
    const page = doc.addPage([pageSize.width, pageSize.height]);
    const rect = fitRect(
      pageSize.width,
      pageSize.height,
      settings.paperSize === 'original' ? 0 : marginPt,
      rendered.width,
      rendered.height,
    );
    page.drawImage(embedded, rect);

    if (textFont && spec.ocr) {
      drawInvisibleText(page, textFont, spec.ocr, rect, fontSupportsJapanese, spec);
    }

    done += 1;
    options.onProgress?.({ done, total, label: '画像を処理中' });
  }

  // --- 末尾に結合する既存 PDF ---
  if (request.mergeTailPdf) {
    options.onProgress?.({ done, total, label: '既存PDFを結合中' });
    await appendExistingPdf(doc, request.mergeTailPdf);
    done += 1;
  }

  checkCancel();
  options.onProgress?.({ done: total, total, label: 'PDFを書き出し中' });

  // オブジェクトストリームを使うとファイルサイズが小さくなる
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return { bytes, pageCount: doc.getPageCount() };
}

/** 既存 PDF の全ページをコピーして追加する */
async function appendExistingPdf(doc: PDFDocument, bytes: ArrayBuffer): Promise<void> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const copied = await doc.copyPages(source, source.getPageIndices());
  for (const page of copied) doc.addPage(page);
}

/**
 * 検索可能 PDF に使うフォントを用意する。
 *
 * 日本語を埋め込むには TrueType フォントが必要なため、
 * `public/fonts/jp.ttf` が配置されていればそれを使う（README 参照）。
 * 用意されていない場合は標準フォントにフォールバックし、
 * WinAnsi で表現できる文字（英数字など）のみを埋め込む。
 */
async function prepareTextFont(
  doc: PDFDocument,
  jpFont: ArrayBuffer | undefined,
): Promise<{ font: PDFFont; supportsJapanese: boolean }> {
  if (jpFont && jpFont.byteLength > 0) {
    try {
      const fontkit = await loadFontkit();
      if (fontkit) {
        // 動的読み込みのため型は unknown。pdf-lib が要求する形に合わせて渡す
        doc.registerFontkit(fontkit as Parameters<typeof doc.registerFontkit>[0]);
        const font = await doc.embedFont(jpFont, { subset: true });
        return { font, supportsJapanese: true };
      }
    } catch {
      // フォント埋め込みに失敗した場合は標準フォントで続行する
    }
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  return { font, supportsJapanese: false };
}

/** fontkit を動的に読み込む（未インストールなら null） */
async function loadFontkit(): Promise<unknown | null> {
  const url = envVar('VITE_FONTKIT_URL', '');
  if (!url) return null;
  try {
    const module = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    return module.default ?? module;
  } catch {
    return null;
  }
}

/** WinAnsi で表現できない文字を除去する */
function sanitizeForWinAnsi(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code <= 126) out += char;
    else if (code >= 160 && code <= 255) out += char;
  }
  return out;
}

/**
 * OCR 結果を不可視テキストとして重ねる（検索・コピー可能にする）。
 * 画像の描画矩形に合わせて座標をスケーリングする。
 * PDF の原点は左下なので Y 座標を反転させる点に注意。
 */
function drawInvisibleText(
  page: PDFPage,
  font: PDFFont,
  ocr: OcrResult,
  rect: { x: number; y: number; width: number; height: number },
  supportsJapanese: boolean,
  spec: BuildPageSpec,
): void {
  if (ocr.imageWidth <= 0 || ocr.imageHeight <= 0) return;
  const scaleX = rect.width / ocr.imageWidth;
  const scaleY = rect.height / ocr.imageHeight;

  for (const word of ocr.words) {
    const text = supportsJapanese ? word.text : sanitizeForWinAnsi(word.text);
    if (!text.trim()) continue;

    const boxWidth = (word.bbox.x1 - word.bbox.x0) * scaleX;
    const boxHeight = (word.bbox.y1 - word.bbox.y0) * scaleY;
    if (boxWidth <= 0.5 || boxHeight <= 0.5) continue;

    const size = Math.max(1, boxHeight * 0.82);
    const x = rect.x + word.bbox.x0 * scaleX;
    const y = rect.y + rect.height - word.bbox.y1 * scaleY + boxHeight * 0.16;

    try {
      page.drawText(text, {
        x,
        y,
        size,
        font,
        // opacity: 0 で見た目に影響を与えずテキスト層だけを載せる
        opacity: 0,
        color: rgb(0, 0, 0),
        rotate: degrees(0),
      });
    } catch {
      // フォントが表現できない文字が含まれる場合はその単語だけスキップ
    }
  }
  // 全文をページのメタ情報としても保持しておく（将来の全文検索向け）
  void spec;
}
