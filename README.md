# SnapPDF

複数の画像を 1 つの PDF にまとめる PWA アプリです。画像も PDF も端末の外へ送信されず、すべてブラウザ内で処理されます。

公開 URL: https://nsaya0607ta-lab.github.io/pdf/

## リポジトリ構成

| パス | 内容 |
| --- | --- |
| `index.html` | 公開されるアプリ本体（JS・CSS・Worker をすべて内包した単一 HTML ビルド） |
| `manifest.webmanifest` | PWA マニフェスト（ホーム画面へ追加するための設定） |
| `icon-*.png` / `apple-touch-icon.png` / `favicon-64.png` | アプリアイコン |
| `.nojekyll` | GitHub Pages の Jekyll 処理を無効化 |
| `snappdf/` | アプリのソースコード（TypeScript + React + Vite） |

## 公開のしくみ

GitHub Pages がリポジトリのルートをそのまま配信します（Settings → Pages → Source は
「Deploy from a branch」／`main` ブランチの `/ (root)`）。ルートのファイルを更新して push すれば、
そのまま公開内容が更新されます。

## ソースからビルドし直す

```bash
cd snappdf
npm install
node scripts/build-standalone.mjs   # → snappdf/snappdf.html
cp snappdf.html ../index.html       # ルートへ配置して公開
```

詳しい開発手順や機能の説明は [`snappdf/README.md`](snappdf/README.md) を参照してください。
