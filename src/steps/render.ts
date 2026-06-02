import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, PUBLIC_DIR, ensureDir, type Caption } from "../lib";

export type RenderInput = {
  /** absolute path to background image or talking-head video */
  bg: string;
  bgType: "image" | "video";
  /** absolute path to narration audio (wav) */
  audio: string;
  captions: Caption[];
  title: string;
  brand: string;
  durationSec: number;
  fps?: number;
  out: string; // absolute output mp4 path
};

/**
 * Stage assets into remotion/public/job, bundle the Remotion project,
 * and render the NewsVideo composition to MP4. This is the "動画編集" step.
 */
export async function renderNewsVideo(input: RenderInput): Promise<string> {
  const fps = input.fps ?? 30;
  const jobDir = await ensureDir(path.join(PUBLIC_DIR, "job"));

  const bgName = "bg" + path.extname(input.bg).toLowerCase();
  const audioName = "narration" + path.extname(input.audio).toLowerCase();
  await copyFile(input.bg, path.join(jobDir, bgName));
  await copyFile(input.audio, path.join(jobDir, audioName));

  const inputProps = {
    bg: `job/${bgName}`,
    bgType: input.bgType,
    audio: `job/${audioName}`,
    captions: input.captions,
    title: input.title,
    brand: input.brand,
    fps,
    durationInSeconds: input.durationSec,
  };

  console.log("📦 Remotion バンドル中...");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "remotion", "index.ts"),
    publicDir: PUBLIC_DIR,
  });

  const composition = await selectComposition({
    serveUrl,
    id: "NewsVideo",
    inputProps,
  });

  console.log(`🎬 レンダリング: ${composition.durationInFrames}f @ ${composition.fps}fps`);
  await ensureDir(path.dirname(input.out));
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: input.out,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r  進捗 ${(progress * 100).toFixed(0)}%   `);
    },
  });
  process.stdout.write("\n");
  return input.out;
}
