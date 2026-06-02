#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ROOT, WORK_DIR, ensureDir, run, expandHome, probeDuration } from "./src/lib";
import { synthSayJa } from "./src/steps/tts";
import { runColabStage } from "./src/steps/colab";
import { transcribeToCaptions } from "./src/steps/transcribe";
import { renderNewsVideo } from "./src/steps/render";

const { values } = parseArgs({
  options: {
    script: { type: "string" },
    face: { type: "string" },
    title: { type: "string", default: "AIニュース" },
    brand: { type: "string", default: "AI NEWS" },
    out: { type: "string", default: "out/preview.mp4" },
    voice: { type: "string", default: "Kyoko" },
    "voice-ref": { type: "string" },
    // GPU 工程の実行先: local (Phase 0: say + プレースホルダ) | remote (Colab: Fishaudio + LTX2.3)
    remote: { type: "boolean", default: false },
    "keep-remote": { type: "boolean", default: false },
  },
  allowPositionals: true,
});

async function main() {
  const scriptPath = values.script ?? "assets/sample/script.txt";
  if (!existsSync(scriptPath)) throw new Error(`script not found: ${scriptPath}`);
  const text = (await readFile(scriptPath, "utf8")).trim();

  const runId = `run-${Date.now()}`;
  const dir = await ensureDir(path.join(WORK_DIR, runId));
  console.log(`📁 作業ディレクトリ: ${path.relative(ROOT, dir)}  (mode: ${values.remote ? "remote/Colab" : "local"})`);

  let wav: string;
  let durationSec: number;
  let bg: string;
  let bgType: "image" | "video";

  if (values.remote) {
    // ── リモート: Colab で [1] 音声生成 + [2] リップシンク ──
    if (!values.face) throw new Error("--remote には --face <顔画像> が必須です");
    const facePath = expandHome(values.face);
    if (!existsSync(facePath)) throw new Error(`face image not found: ${facePath}`);

    console.log("\n☁️  [1+2/3] Colab (Fishaudio + LTX2.3) ...");
    const res = await runColabStage({
      jobId: runId,
      scriptText: text,
      facePath,
      voiceRef: values["voice-ref"] ? expandHome(values["voice-ref"]) : undefined,
      workDir: dir,
      keepRemote: values["keep-remote"],
    });
    wav = res.audio;
    durationSec = await probeDuration(res.audio);
    bg = res.video;
    bgType = "video";
    console.log(`   → 音声 ${durationSec.toFixed(1)}s / リップシンク動画 取得`);
  } else {
    // ── ローカル (Phase 0): say で音声、顔画像 or プレースホルダ背景 ──
    console.log("\n🗣️  [1/3] 音声生成 (ローカル say) ...");
    ({ wav, durationSec } = await synthSayJa(text, path.join(dir, "narration.wav"), values.voice));
    console.log(`   → ${path.relative(ROOT, wav)} (${durationSec.toFixed(1)}s)`);

    if (values.face) {
      bg = expandHome(values.face);
      if (!existsSync(bg)) throw new Error(`face image not found: ${bg}`);
      bgType = /\.(mp4|mov|webm)$/i.test(bg) ? "video" : "image";
    } else {
      bg = path.join(dir, "bg.png");
      bgType = "image";
      console.log("   背景画像なし → プレースホルダ生成");
      await run(
        "ffmpeg",
        ["-y", "-f", "lavfi", "-i", "color=c=0x0b1a3a:s=1920x1080", "-frames:v", "1", bg],
        { quiet: true },
      );
    }
  }

  // [3] テロップ音声合わせ (Whisper) — どちらのモードでも共通
  console.log("\n📝 [3/3a] Whisper でテロップ整合 ...");
  const captions = await transcribeToCaptions(wav, path.join(dir, "whisper"), { language: "ja" });
  console.log(`   → ${captions.length} セグメント`);

  // [4] 動画編集 (Remotion)
  console.log("\n🎞️  [3/3b] Remotion で合成 ...");
  const out = path.resolve(values.out!);
  await renderNewsVideo({
    bg,
    bgType,
    audio: wav,
    captions,
    title: values.title!,
    brand: values.brand!,
    durationSec,
    out,
  });

  console.log(`\n✅ 完成: ${out}`);
}

main().catch((e) => {
  console.error("\n❌ 失敗:", e.message);
  process.exit(1);
});
