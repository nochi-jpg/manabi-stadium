# まなびスタジアム（manabi-stadium）

先生専用の「豪華版とうぎじょう」。まなびバトル（nochi-jpg/manabi-battle）の QR を読みこみ、電子黒板の大画面で対戦する。

- となりに `manabi-battle`（公開）と `manabi-battle-assets`（非公開）を clone して使う
- 組み立て：`python3 tools/build.py` → `dist/index.html`（くわしくは HANDOFF.md）
- `sample/`：3Dスタジアム演出のサンプル。`python3 sample/build.py` で素材を埋めこんだ1ファイル `sample/stadium_sample.html` を作る（gitignore。素材入りなので公開しない）。`?at=秒` で その場面で止まる、`?light` で かるいモード
- `lib/three.iife.js`：Three.js r186（MIT）を script タグで読める形にしたもの（`tools/bundle_three.py`）
- 職場PC（電子黒板）で 60FPS を確認（10/3）

ディレクション・ゲームデザイン・企画 K.nom
