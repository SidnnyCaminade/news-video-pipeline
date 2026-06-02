# SETUP — Phase 1 (Colab 連携) のセットアップ

GPU 工程（Fishaudio 音声生成 + LTX-2.3 リップシンク）を Colab で動かし、
Mac の `cli.ts --remote` と Google Drive フォルダ越しに連携するための手順。

## 0. 全体像

```
Mac (cli.ts)  ──rclone──>  Google Drive : news-video-pipeline/inbox/<jobId>/
                                                   │  (Colab がマウントして監視)
Colab worker  ──処理──>     Google Drive : news-video-pipeline/outbox/<jobId>/
Mac (cli.ts)  <──rclone──   done.json を検知して pull
```

Mac の rclone remote `gdrive:news-video-pipeline` と Colab の
`/content/drive/MyDrive/news-video-pipeline` が**同じ Drive フォルダ**を指すのがポイント。

## 1. Drive フォルダを作る

Google Drive のマイドライブ直下に `news-video-pipeline` フォルダを作成（中身は空でOK。
Colab 側が `inbox/` `outbox/` `models_cache/` を自動生成する）。

## 2. Mac 側: rclone 設定（初回だけ・要 Google ログイン）

rclone は導入済み。OAuth ログインはブラウザで本人が実施する。プロンプトに次を貼って実行:

```
! rclone config
```

- `n` (new remote) → name: **gdrive** → storage: **drive**（Google Drive）
- client_id / secret は空でEnter（自動）→ scope: `1`（フルアクセス）
- 「Use auto config?」→ **y** → ブラウザが開く → Google ログイン・許可
- team drive: `n` → 確認して `q` で終了

確認:

```bash
rclone listremotes          # gdrive: が出ればOK
rclone lsd gdrive:news-video-pipeline   # フォルダが見えればOK
```

remote 名を変えたい場合は環境変数 `RCLONE_REMOTE`（既定 `gdrive:news-video-pipeline`）で上書き可。

## 3. Colab 側: ワーカー起動

1. `colab/colab_worker.ipynb` を Colab で開く（GitHub に push 済みなら GitHub から開ける）
2. ランタイム → タイプを変更 → **A100**（22B は 32GB+ VRAM 推奨。T4 しか無い場合は GGUF 量子化版に差替）
3. 上から全セル実行。最後の `worker_loop()` が `inbox/` の監視に入る（**実行しっぱなしにする**）

## 4. 顔画像とテロップ素材

- アナウンサーの顔画像は **GPT（画像生成）で用意** → `~/anchor.png` などに保存
- 台本は `assets/sample/script.txt` を編集 or 別ファイルを `--script` で渡す

## 5. 実行

```bash
bun cli.ts run --remote --face ~/anchor.png --script assets/sample/script.txt --out out/news.mp4
```

## 実機検証で要調整な箇所（ノートブック内に TODO コメントあり）

1. **HF repo id** (`LTX_REPO`): LTX-2.3 weights の配布元 repo id を実物に合わせる
   （`Lightricks/LTX-2.3` を仮置き。`Kijai/LTX2.3_comfy` / `unsloth/LTX-2.3-GGUF` なども候補）
2. **fish-speech の CLI 引数**: バージョンで `tools.llama.generate` / `tools.vqgan.inference` の
   引数が変わる。参照音声クローン (`voice_ref`) の渡し方は要確認
3. **LTX Lipdub ワークフローのノード差し替え**: `_patch_inputs()` が `LoadImage` / `LoadAudio` を
   名前で探して入力を差し替える。実ワークフローの class_type / 保存ノードを一度開いて確認

## トラブルシュート

- `Colab の結果がタイムアウト`: ワーカーが起動・監視中か、Drive フォルダ名が一致しているか確認
- VRAM 不足: distilled モデル + GGUF 量子化、解像度・尺を下げる、`--reserve-vram` を付ける
