# news-video-pipeline

格安リップシンク・ニュース動画の自動生成パイプライン。
**LTX2.3 + Fishaudio + Whisper + Remotion** を1コマンドで連結する。

```
台本.txt + 顔.png
   │
   ├─[1] 音声生成   Fishaudio/fish-speech   → narration.wav   ← GPU (Colab)
   ├─[2] リップシンク LTX2.3                 → talking.mp4     ← GPU (Colab / A100)
   ├─[3] テロップ整合 Whisper (ローカル)       → captions (語/文タイムスタンプ)
   └─[4] 動画編集    Remotion (ローカル)       → final.mp4
        ▲
   オーケストレーター (Bun/TS, cli.ts) が全工程を連結
```

GPU が要る [1][2] は Colab、[3][4] は Mac ローカル。Colab↔Mac の受け渡しは **Google Drive フォルダ** をバスにする。

## 構成

| パス | 役割 |
|------|------|
| `cli.ts` | オーケストレーター本体。`bun cli.ts run ...` |
| `src/steps/tts.ts` | [1] 音声生成（Phase 0 は macOS `say`、Phase 1 で Fishaudio/Colab に差替） |
| `src/steps/lipsync.ts` | [2] LTX2.3 リップシンク（Colab 連携。Phase 1） |
| `src/steps/transcribe.ts` | [3] Whisper でテロップ時刻整合 |
| `src/steps/render.ts` | [4] Remotion で合成・レンダリング |
| `src/bridge/drive.ts` | Colab↔Mac の Google Drive 受け渡し（Phase 1） |
| `remotion/` | Remotion プロジェクト（`NewsVideo` コンポジション） |
| `colab/` | Colab ノートブック（Fishaudio TTS / LTX2.3 lipsync） |
| `assets/sample/` | サンプル台本など |
| `work/` | 実行ごとの作業ディレクトリ（gitignore） |

## 使い方（Phase 0: Mac ローカル完結）

```bash
bun install
# 顔画像なし → 紺色プレースホルダ背景で生成
bun cli.ts run --script assets/sample/script.txt --out out/preview.mp4
# 顔画像（GPT 生成など）を背景に
bun cli.ts run --script assets/sample/script.txt --face ~/face.png --title "AIニュース"
```

Remotion Studio でプレビュー編集:

```bash
bun run studio
```

## 前提ツール

- Bun / Node 20、ffmpeg、whisper.cpp (`whisper-cli`) + モデル `~/.whisper-models/ggml-base.bin`
- Remotion 初回レンダリング時に Chrome Headless Shell を自動ダウンロード

## 使い方（Phase 1: Colab 連携 = 本番）

セットアップは [SETUP.md](./SETUP.md) 参照（rclone 設定 + Colab ワーカー起動）。

```bash
# Colab で colab/colab_worker.ipynb を A100 ランタイムで起動しておく（inbox 監視状態）
bun cli.ts run --remote --script assets/sample/script.txt --face ~/anchor.png \
  --title "AIニュース" --out out/news.mp4
# 声質クローンする場合: --voice-ref ~/ref_voice.wav
```

`--remote` 時の流れ: 台本+顔を Drive `inbox/<jobId>/` にアップ → Colab が Fishaudio で音声・
LTX-2.3 でリップシンク動画を生成し `outbox/<jobId>/` に出力 → Mac が pull → Whisper で
テロップ整合 → Remotion で合成。

## ロードマップ

- [x] **Phase 0**: Mac ローカル完結版（say → Whisper → Remotion）で画を出す
- [x] **Phase 1**: 本物の部品（fish-speech / LTX-2.3 Colab ワーカー / rclone-Drive 受け渡し）
  - [x] rclone-Drive バス (`src/bridge/drive.ts`)
  - [x] Colab→Mac 連携ステップ (`src/steps/colab.ts`)、`cli.ts --remote`
  - [x] Colab ワーカーノートブック (`colab/colab_worker.ipynb`)
  - [ ] **要実機検証**: fish-speech の CLI 引数、LTX Lipdub ワークフローのノード差し替え、HF repo id
- [ ] **Phase 2**: テロップ内容を台本テキスト基準にする（Whisper は時刻整合のみ）、複数ジョブ並列、字幕スタイルのプリセット

## 既知の改善ポイント

- Phase 0 のテロップは Whisper の認識テキストをそのまま使うため、`say` の機械音声では誤認識が出る
  （例: 「高性能なGPU」→「構成の同じP,U」）。Phase 1 では **台本テキストをテロップ内容に使い、
  Whisper は時刻整合のみ** に使う方式へ変更予定。
