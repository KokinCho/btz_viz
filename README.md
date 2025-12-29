# BTZ Black Hole Web Visualization / BTZブラックホール可視化

Interactive web-based visualization of the BTZ black hole embedding in AdS3 spacetime.
AdS3時空におけるBTZブラックホールの埋め込みを、ブラウザ上でインタラクティブに操作・可視化できるツールです。

## Demo / デモ
[Click here to view the demo](https://kokincho.github.io/btz_viz/) (After enabling GitHub Pages)

## Features / 特徴

- **4D Embedding View**:
  Visualizes the surface defined by:
  $$-(X^{-1})^2 - (X^0)^2 + (X^1)^2 + (X^2)^2 = -l^2$$
  埋め込み条件式に基づく曲面を3次元空間に投影して表示します。

- **Interactive Physics Parameters / 物理パラメータの操作**:
  - **Mass ($M$)**: ブラックホールの質量。ホライズン半径 ($r_h = l\sqrt{M}$) を決定します。
  - **AdS Radius ($l$)**: 時空の曲率半径。
  - **Lorentz Boost ($\lambda$)**: 時間($X^0$)と空間($X^1$)を混合するブースト変換を適用し、観測者の運動による見え方の変化をシミュレートします。

- **Visualization Modes / 可視化モード**:
  - **Embedding**: 4次元的埋め込み図を表示。
  - **Poincaré Disk**: ポアンカレ円板（共形図）への射影を表示。因果構造の理解に役立ちます。

## Controls / 操作方法

- **Time (t)**: 時間発展をシミュレート（静的解なので、ブーストスライスが移動する様子として見えます）。
- **Lorentz Boost ($\lambda$)**: $(X^0, X^1)$ 平面でのLorentzブースト。
- **Spatial Rotation**: $(X^1, X^2)$ 平面での空間回転。
- **Radial Extent**: 表示する動径方向の範囲（$r_{max}$）を調整。

## How to Run Locally / ローカルでの実行

This project uses ES Modules and requires a local HTTP server.
ES Modulesを使用しているため、ローカルサーバー経由で開く必要があります。

1. Pythonがインストールされていることを確認してください。
2. ディレクトリ内で以下のコマンドを実行:
   ```bash
   python3 -m http.server 8000
   ```
3. ブラウザで `http://localhost:8000` を開きます。

## License

MIT License