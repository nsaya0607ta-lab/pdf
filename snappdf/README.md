# SnapPDF — 複数画像をまとめて1つのPDFにするアプリ

スマートフォンで撮影した画像を、並び替え・補正・トリミングしてから 1 つの PDF にまとめる Web アプリ（PWA）です。
**iPhone / Android / PC のブラウザ**でそのまま動き、ホーム画面に追加すればネイティブアプリのように使えます。

画像も PDF も**端末の外に一切送信されません**。すべての処理はブラウザ内で完結します。

---

## GitHub へ公開する

このリポジトリは GitHub Pages へそのまま公開できるよう設定済みです。

```bash
# 1. GitHub で空のリポジトリを作る（例: snappdf）
# 2. このフォルダで実行
git init
git add -A
git commit -m "feat: SnapPDF 初回コミット"
git branch -M main
git remote add origin https://github.com/<ユーザー名>/snappdf.git
git push -u origin main
```

push 後、リポジトリの **Settings → Pages → Source** を「**GitHub Actions**」に変更すると、
`.github/workflows/deploy.yml` が自動でビルドして公開します。

```
https://<ユーザー名>.github.io/snappdf/            ← アプリ本体
https://<ユーザー名>.github.io/snappdf/snappdf.html ← 単一ファイル版
```

`.github/workflows/ci.yml` は push / Pull Request のたびに型チェックとビルドを検証します。

---

## 目次

- [主な機能](#主な機能)
- [セットアップ手順](#セットアップ手順)
- [使い方](#使い方)
- [ディレクトリ構成](#ディレクトリ構成)
- [使用技術と設計方針](#使用技術と設計方針)
- [パフォーマンス](#パフォーマンス)
- [動作確認](#動作確認)
- [OCR と検索可能 PDF について](#ocr-と検索可能-pdf-について)
- [今後追加しやすい機能](#今後追加しやすい機能)
- [既知の制約](#既知の制約)

---

## 主な機能

### 画像選択

- 最大 **100 枚**まで／複数選択対応
- **ドラッグ＆ドロップ**（Web）
- **カメラロールから選択**（`accept="image/*"`）
- **その場で撮影**（`capture="environment"`）
- **ファイル選択**（画像・PDF）

### 並び替え

- サムネイルを**ドラッグして順番変更**（タッチ対応・端に寄せると自動スクロール）
- 一括並び替え：**名前順 / 更新日時順 / 撮影日時順**（同じ項目を再選択で昇順⇔降順）
- 現在の並びを**逆順**にする

### プレビュー

- サムネイル一覧（ページ番号つき）
- タップで**拡大表示**（左右スワイプ・矢印キーで移動、解像度・容量・撮影日時を表示）

### 編集（ページごと）

- **回転**（左 90° / 右 90°）
- **トリミング**（枠をドラッグ／四隅・四辺のハンドルでリサイズ）
- **削除** / **複製**
- 自動補正のページ個別オン・オフ

### PDF 作成

| 項目 | 選べる値 |
| --- | --- |
| 用紙サイズ | A4 / A3 / B5(JIS) / Letter / 元画像サイズ |
| 向き | 縦 / 横 / 自動（画像の縦横比に合わせる） |
| 余白 | なし / 小(5mm) / 中(10mm) / 大(20mm) |
| 画質 | 高画質(約300dpi) / 標準(約200dpi) / 軽量(約120dpi) |
| ファイル名 | 自由入力 |

### 出力

- **保存**（ダウンロード）
- **共有・他アプリへ送信**（Web Share API・iOS/Android の共有シート）
- **印刷**

### 履歴

- 作成した PDF を**端末内（IndexedDB）に自動保存**。アプリを閉じても残ります
- ヘッダーの時計アイコンから一覧を表示（サムネイル・ページ数・サイズ・作成日時）
- 履歴から **保存 / 共有 / 印刷 / 編集（ページとして読み込み直す） / 削除**
- 取り込み画面にも「最近作成したPDF」を表示
- 履歴を残さない設定も可能。上限は 30 件・合計 300MB で、超えたら古いものから自動削除

### 画面移動

- ページ一覧の**左上の「←」でホーム画面へ戻れます**。
  戻ってもページは保持され、ホームに出る「編集中のページが N 枚あります」から続きを再開できます
- すべてのシートと拡大プレビューの左上にも**「戻る」ボタン**
- **Android の戻るボタン／ブラウザバック**でも 1 つ前に戻れます
  （`useBackDismiss` が履歴エントリをスタックで管理し、
  重なった画面のうち一番手前だけが反応するようにしています）
- トリミング中の戻る操作は、シートを閉じずにトリミングだけ取り消します

### 追加機能

- **PDF 圧縮** — 作成後に画質を選び直して再生成（実測：105KB → 54.6KB）
- **OCR** — 日本語＋英語の文字認識。検索可能 PDF へ拡張できる設計
- **自動補正** — 傾き補正 / 明るさ補正 / コントラスト補正 / 白黒スキャン化（一括 ON/OFF・ページ個別変更）
- **ページ追加** — 作業途中でいつでも追加可能
- **ページ削除** — 選択モードで複数まとめて削除
- **PDF 結合** — 既存 PDF を読み込むとページとして取り込まれ、画像と混ぜて並べ替えできる
- **PDF 分割** — 範囲指定（`1-3, 5, 8-10`）／ N ページごと／ 1 ページずつ（複数ファイルは ZIP でまとめて保存）
- **最近使った設定** — 用紙サイズ・向き・余白・画質・補正設定・テーマを自動保存し次回復元
- **ダークモード** — ライト／ダーク対応（システム連動）
- **PWA** — ホーム画面に追加、オフライン起動

---

## セットアップ手順

### 必要環境

- Node.js 18 以上（推奨 20 以上）
- npm 9 以上

### インストールと起動

```bash
# 1. 依存パッケージをインストール
npm install

# 2. 開発サーバーを起動（http://localhost:5173）
npm run dev
```

`npm run dev` は自動で `scripts/prepare-assets.mjs` を実行し、
pdf.js のワーカーファイルを `public/` へ配置します。

スマートフォンの実機で確認する場合は、同じ Wi-Fi 上で表示された
`Network:` の URL（例 `http://192.168.0.5:5173`）を開いてください。

### 本番ビルド

```bash
npm run build     # 型チェック → dist/ に出力
npm run preview   # ビルド結果をローカルで確認
```

`dist/` の中身をそのまま静的ホスティング（Netlify / Vercel / GitHub Pages / S3 など）へ
置くだけで公開できます。相対パス出力（`base: './'`）なのでサブディレクトリ配信も可能です。

> **HTTPS で配信してください。** カメラ起動・共有・Service Worker は
> `https://`（または `localhost`）でのみ動作します。

### 単一 HTML ファイル版（サーバー不要）

```bash
node scripts/build-standalone.mjs   # → snappdf.html（約 2.7MB）
```

JS・CSS・Web Worker・pdf.js をすべて 1 つの HTML に埋め込みます。
ファイルを配布するだけで動くので、共有や動作確認に便利です。

- ブラウザで開くだけで全機能が使えます（`file://` で直接開いても動作します）
- `file://` など Worker を起動できない環境では、自動的にメインスレッド実行へ
  フォールバックします（機能は同じ、速度のみ低下）

### その他のコマンド

```bash
npm run typecheck        # 型チェックのみ
npm run prepare-assets   # pdf.js ワーカーを public/ に再配置
```

---

## 使い方

```
①画像一覧  →  ②並び替え  →  ③画像編集  →  ④PDF設定  →  ⑤PDF作成  →  ⑥保存・共有
```

画面遷移を減らすため、**一覧画面を中心に据え、各機能はシート（モーダル）で重ねる**構成にしています。
どの操作からも 1 タップで一覧へ戻れます。

1. 「写真を選ぶ」「カメラで撮る」「ファイルを選ぶ」またはドラッグ＆ドロップで画像を追加
2. カード右上の⠿ハンドルをドラッグして並び替え（「並び替え」ボタンで一括ソートも可能）
3. カード下部の✏️で編集シートを開き、回転・トリミング・補正を調整
4. 下部の「設定」で用紙サイズや画質を指定
5. 「PDF を作成」をタップ（進捗バーが表示され、いつでもキャンセル可能）
6. 完成画面から保存・共有・印刷、必要なら圧縮・分割

---

## ディレクトリ構成

```
snappdf/
├── index.html                     エントリ HTML
├── package.json
├── tsconfig.json                  TypeScript 設定（strict + 追加チェック）
├── vite.config.ts                 Vite 設定（相対パス出力・チャンク分割）
│
├── public/                        そのまま配信される静的ファイル
│   ├── manifest.webmanifest       PWA マニフェスト
│   ├── sw.js                      Service Worker（アプリシェルのみキャッシュ）
│   ├── icon.svg / icon-*.png      アイコン
│   └── pdf.worker.min.mjs         pdf.js ワーカー（prepare-assets が配置）
│
├── scripts/
│   ├── prepare-assets.mjs         pdf.js ワーカーの配置＋互換ポリフィル注入
│   ├── build-standalone.mjs       単一 HTML ファイル版のビルド
│   └── esbuild-preview.mjs        Vite が使えない環境向けの検証用ビルド
│
├── tests/                         動作検証スクリプト（Playwright）
│   ├── e2e.mjs                    主要機能の通しテスト（20 項目）
│   ├── stress.mjs                 100 枚の負荷テスト
│   ├── drag.mjs                   ドラッグ並び替えのテスト
│   └── fixtures/                  テスト用画像
│
└── src/
    ├── main.tsx                   エントリポイント
    ├── App.tsx                    画面全体の組み立てと操作フロー
    ├── types.ts                   アプリ共通の型定義
    ├── constants.ts               用紙サイズ・画質プリセットなどの定数
    ├── registerSW.ts              Service Worker 登録
    │
    ├── components/                UI コンポーネント
    │   ├── HistorySheet.tsx       作成したPDFの履歴一覧
    │   ├── ui.tsx                 汎用部品（シート／セグメント／スイッチ／メニュー）
    │   ├── icons.tsx              インライン SVG アイコン
    │   ├── EmptyState.tsx         取り込み画面
    │   ├── PageGrid.tsx           一覧＋ドラッグ並び替え
    │   ├── PageCard.tsx           ページカード（Lazy Load サムネイル）
    │   ├── Lightbox.tsx           拡大プレビュー
    │   ├── PageEditor.tsx         編集シート
    │   ├── CropOverlay.tsx        トリミング枠
    │   ├── SettingsSheet.tsx      PDF 設定
    │   ├── ResultSheet.tsx        作成結果（保存・共有・印刷・圧縮・分割）
    │   ├── ProgressOverlay.tsx    進捗表示とキャンセル
    │   └── Toasts.tsx             通知
    │
    ├── hooks/
    │   ├── useJob.ts              進捗・キャンセルの共通化
    │   ├── useThumbnail.ts        画面内に入ったら生成する Lazy Load
    │   ├── useBackDismiss.ts      端末の戻る操作でシートを閉じる
    │   ├── useBlobUrl.ts          ObjectURL の生成と解放
    │   └── useTheme.ts            ライト／ダーク切り替え
    │
    ├── store/
    │   ├── appReducer.ts          状態遷移（純粋関数）
    │   └── AppContext.tsx         Context と設定の永続化
    │
    ├── lib/
    │   ├── db.ts                  IndexedDB の最小ラッパー
    │   ├── history.ts             作成したPDFの履歴管理
    │   ├── imagePipeline.ts       画像処理パイプライン（回転・切抜・縮小・再エンコード）
    │   ├── enhance.ts             自動補正アルゴリズム（傾き／レベル／二値化）
    │   ├── exif.ts                EXIF 撮影日時の読み取り（自前実装）
    │   ├── importFiles.ts         ファイル取り込み（画像・PDF）
    │   ├── pipelineClient.ts      Worker クライアント（非対応環境はメインスレッドで代替）
    │   ├── thumbnails.ts          サムネイルの LRU キャッシュと同時実行制御
    │   ├── ocr.ts                 OCR（Tesseract.js の動的読み込み）
    │   ├── share.ts               保存・共有・印刷
    │   ├── storage.ts             設定の永続化
    │   ├── zip.ts                 ZIP 書き出し（自前実装・無圧縮）
    │   ├── pageUtils.ts           ページ配列の操作ユーティリティ
    │   ├── polyfills.ts           pdf.js 用の互換ポリフィル
    │   ├── env.ts                 ビルド環境差分の吸収
    │   ├── util.ts                汎用ユーティリティ
    │   └── pdf/
    │       ├── build.ts           PDF 組み立て（pdf-lib）
    │       ├── paper.ts           用紙サイズ・余白の計算
    │       ├── compress.ts        PDF 再圧縮
    │       ├── split.ts           PDF 分割
    │       └── pdfjs.ts           既存 PDF のラスタライズ（pdf.js）
    │
    ├── workers/
    │   └── pipeline.worker.ts     画像処理と PDF 生成を担う Web Worker
    │
    └── styles/
        └── global.css             デザインシステム（CSS 変数・レスポンシブ）
```

---

## 使用技術と設計方針

### 技術スタック

| 技術 | 用途 |
| --- | --- |
| **React 19 + TypeScript** | UI と型安全な状態管理 |
| **Vite 6** | 開発サーバー・本番ビルド |
| **pdf-lib** | PDF の生成・結合・分割 |
| **pdf.js (pdfjs-dist)** | 既存 PDF の読み込みとラスタライズ |
| **Tesseract.js** | OCR（実行時に動的読み込み） |
| **Canvas / OffscreenCanvas** | 画像の回転・切り抜き・補正・再エンコード |
| **Web Worker** | 重い処理をメインスレッドから分離 |
| **CSS 変数** | ライト／ダークテーマ |

### 依存を最小限にする方針

UI 系のライブラリは使わず、以下は自前実装しています。バンドルが軽くなり、
ライブラリのバージョン追従コストもなくなります。

- **ドラッグ並び替え** — Pointer Events で実装（`PageGrid.tsx`）。タッチ／マウス両対応
- **トリミング枠** — 正規化座標で保持し、Pointer Events で移動・リサイズ（`CropOverlay.tsx`）
- **EXIF 解析** — 撮影日時タグのみを読む軽量パーサー（`exif.ts`）
- **ZIP 書き出し** — 無圧縮 ZIP を生成（`zip.ts`）
- **アイコン** — インライン SVG（`icons.tsx`）

### 非破壊編集

回転・トリミング・補正はすべて**パラメータとして保持**し、表示・出力のたびに
**元画像から作り直します**。そのため

- 何度編集しても画質が劣化しない
- 設定変更（画質など）が全ページへ即座に反映される
- 元画像 1 枚あたりのメモリ保持は Blob 1 つだけで済む

### 状態管理

`useReducer` による単一ストア（`store/appReducer.ts`）。
状態遷移はすべて純粋関数なので、追跡もテストも容易です。
Context は `state` と `dispatch` を分離して提供し、不要な再レンダリングを避けています。

### エラーハンドリング

- 画像 1 枚の読み込み失敗が全体を止めないよう、ファイル単位で捕捉して通知
- HEIC など未対応形式は理由を明示（「HEIC 形式はこのブラウザで読み込めません」）
- 上限 100 枚の超過分はスキップして件数を通知
- OCR エンジンの読み込み失敗、localStorage 不可（プライベートブラウズ）などは
  機能を落として動作継続
- 処理中の離脱には確認ダイアログ

---

## パフォーマンス

### 設計上の工夫

| 課題 | 対策 |
| --- | --- |
| UI が固まる | 画像処理と PDF 生成を **Web Worker** で実行（`pipeline.worker.ts`） |
| 100 枚分のメモリ | サムネイルは **LRU キャッシュ**（上限 150 件）、超過分は `URL.revokeObjectURL` で解放 |
| 一斉デコードによる枯渇 | サムネイル生成の**同時実行数を 3 に制限**（セマフォ） |
| 初期表示が重い | `IntersectionObserver` による **Lazy Load**（400px 手前から先読み） |
| メモリリーク | `ImageBitmap` は使用後に必ず `close()`、削除時にキャッシュも破棄 |
| 長時間処理 | 進捗バー＋**キャンセル**（`AbortSignal` を Worker まで伝播） |
| 巨大画像 | 画質プリセットの長辺上限まで縮小してから処理 |

### 実測値

2400×3200px の JPEG **100 枚**（計 9.1MB）を Chromium / モバイル相当のビューポートで処理：

| 項目 | 結果 |
| --- | --- |
| 取り込み（100 枚） | **5.4 秒** |
| PDF 生成（A4・標準画質・自動補正あり） | **34.8 秒** |
| 進捗バー表示までの時間 | **352 ms** |
| JS ヒープ使用量（処理中も） | **約 20 MB** |
| 出力 PDF | 100 ページ / 5.67 MB |
| クラッシュ・コンソールエラー | なし |

生成中も進捗が途切れず更新され続け、UI 操作を受け付けたままでした。

---

## 動作確認

Playwright による自動テストを同梱しています。

```bash
# 事前に検証用バンドルを作る（Vite でビルドした dist/ でも可）
node scripts/esbuild-preview.mjs

node tests/e2e.mjs        # 主要機能の通しテスト（20 項目）
node tests/history.mjs    # 戻るボタンと PDF 履歴（12 項目）
node tests/home-nav.mjs   # ホーム画面への戻り動作（10 項目）
node tests/drag.mjs       # ドラッグ並び替え
node tests/standalone.mjs # 単一 HTML ファイル版（http:// と file:// の両方）
node tests/stress.mjs     # 100 枚の負荷テスト（tests/fixtures/bulk/ に画像を用意）
```

`tests/history.mjs` の確認項目（すべて成功）:

```
OK 作成直後に「履歴に保存されました」と案内される
OK シートに「戻る」ボタンがある
OK 端末の戻る操作でシートが閉じる
OK 履歴にPDFが表示される
OK 履歴にサムネイルが表示される
OK 履歴から保存したPDFが正しい
OK リロード後も履歴が残り、取り込み画面に表示される
OK 履歴のPDFをページとして読み込める
OK 履歴から削除できる
OK 履歴のオン/オフ設定が保存される
OK 戻るボタンでシートを閉じられる
OK コンソールエラーが出ていない
```

`tests/e2e.mjs` の確認項目（すべて成功）:

```
OK 初期画面が表示される
OK 3 枚の画像が取り込まれサムネイルが生成される
OK 名前順（降順）で並び替えできる
OK 逆順にできる
OK 拡大プレビューにページ番号が出る
OK 編集シートで回転できる
OK トリミングが適用される
OK ページを複製できる
OK ページを削除できる
OK PDF 設定を変更できる
OK PDF が生成される
OK PDF のページ数と用紙サイズが正しい（A4 = 595×842pt）
OK PDF を再圧縮するとサイズが小さくなる（105KB → 54.6KB）
OK 分割結果を ZIP で保存できる
OK ダークモードに切り替わる
OK 設定が次回起動時に復元される
OK デスクトップ幅でも崩れない
OK 既存 PDF を読み込んでページとして結合できる
OK 重い処理が Web Worker で実行されている
OK コンソールエラーが出ていない
```

スクリーンショットは `tests/output/` に保存されます。

---

## OCR と検索可能 PDF について

### OCR の読み込み方法

Tesseract.js（約 5MB＋言語データ）は初期バンドルに含めず、**初回実行時に動的読み込み**します。
既定は CDN からの取得で、初回のみネットワーク接続が必要です。

**完全オフラインにしたい場合**は、パッケージを追加して `.env` で読み込み先を差し替えてください。

```bash
npm i tesseract.js
```

```bash
# .env
VITE_TESSERACT_URL=/node_modules/tesseract.js/dist/tesseract.esm.min.js
```

### 検索可能 PDF

OCR 結果は**単語ごとの座標つき**で保持され、PDF 生成時に画像の上へ
**不可視のテキスト層**（`opacity: 0`）として重ねます。見た目は変わらず、検索とコピーが可能になります。

日本語を埋め込むには TrueType フォントが必要です。次の手順で有効化できます。

1. 日本語フォント（例: Noto Sans JP）を用意する
2. `.env` に fontkit の読み込み先を設定する
   ```bash
   VITE_FONTKIT_URL=https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.es.min.js
   ```
3. `src/lib/pdf/build.ts` の `buildPdf` へ `jpFont`（フォントの `ArrayBuffer`）を渡す

フォント未設定時は標準フォントで表現できる文字（英数字など）のみを埋め込み、
日本語部分はアプリ内で閲覧・コピーできる形で保持します。

---

## 今後追加しやすい機能

拡張ポイントを意識して層を分けてあります。追加時に触るファイルの目安つきで挙げます。

| 機能 | 実装の目安 |
| --- | --- |
| **クラウド保存**（Google Drive / iCloud / Dropbox） | `lib/share.ts` に保存先を追加。`ResultSheet.tsx` にボタンを 1 つ足すだけ |
| **日本語フォント同梱の検索可能 PDF** | `public/fonts/` にフォントを置き、`build.ts` の `jpFont` へ渡す（受け口は実装済み） |
| **パスワード保護 PDF** | pdf-lib の暗号化対応版、または qpdf-wasm を `lib/pdf/` に追加 |
| **透かし・ページ番号の挿入** | `lib/pdf/build.ts` の `drawImage` 後に `drawText` を追加 |
| **四隅検出による台形補正** | `lib/enhance.ts` に射影変換を追加（傾き補正と同じ層） |
| **注釈・手書き署名** | `PageEditor.tsx` に描画レイヤーを追加し、`PageItem` に注釈配列を持たせる |
| **作業内容の自動保存（復元）** | `lib/storage.ts` を IndexedDB 化し、`PageItem.blob` を保存 |
| **元に戻す / やり直す** | `store/appReducer.ts` を履歴付き reducer でラップ |
| **PDF のページ単位編集（回転・削除）** | 取り込み済み PDF ページも `PageItem` なので既存機能がそのまま使える |
| **多言語対応（i18n）** | 文言を辞書化。UI 文字列はコンポーネント内に閉じている |
| **ネイティブアプリ化** | Capacitor でラップ。処理層（`lib/`）は変更不要 |

---

## 既知の制約

- **HEIC/HEIF** は Safari 以外のブラウザでデコードできません（明示的にエラー通知します）。
  対応が必要な場合は `libheif-js` を `lib/importFiles.ts` に追加してください。
- **PDF 結合はラスタライズ方式**です。既存 PDF はページ画像として取り込まれるため、
  画像と混ぜて並べ替え・編集できる代わりに、元 PDF のテキスト情報は失われます。
  テキストを保持したまま結合したい場合は `lib/pdf/build.ts` の
  `mergeHeadPdf` / `mergeTailPdf`（実装済み）を利用してください。
- **iOS Safari の印刷**は iframe 経由の印刷に制限があるため、新規タブで PDF を開きます。
- **Web Share API** 非対応ブラウザでは「共有」ボタンが無効になります（保存は可能です）。
- 作業内容はメモリ上のみで保持しています。リロードすると失われます
  （離脱時に確認ダイアログを表示します）。

---

## ライセンス

このリポジトリのコードは自由に利用・改変できます。
同梱ライブラリのライセンスは各パッケージに従ってください（pdf-lib: MIT / pdf.js: Apache-2.0 / Tesseract.js: Apache-2.0）。
