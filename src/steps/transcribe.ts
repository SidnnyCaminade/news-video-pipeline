import { readFile } from "node:fs/promises";
import path from "node:path";
import { run, expandHome, type Caption } from "../lib";

const DEFAULT_MODEL = expandHome(
  process.env.WHISPER_MODEL ?? "~/.whisper-models/ggml-base.bin",
);

type WhisperJson = {
  transcription: Array<{
    offsets: { from: number; to: number }; // milliseconds
    text: string;
  }>;
};

/**
 * Run whisper.cpp (whisper-cli) on a 16kHz WAV and return segment-level captions
 * with timestamps aligned to the actual narration audio. This is the "テロップ音声合わせ" step.
 */
export async function transcribeToCaptions(
  wav: string,
  outPrefix: string,
  opts: { language?: string; model?: string; maxLen?: number } = {},
): Promise<Caption[]> {
  const model = opts.model ?? DEFAULT_MODEL;
  const args = [
    "-m",
    model,
    "-f",
    wav,
    "-l",
    opts.language ?? "ja",
    "-oj",
    "-of",
    outPrefix,
  ];
  if (opts.maxLen) args.push("-ml", String(opts.maxLen));
  await run("whisper-cli", args);

  const jsonPath = outPrefix + ".json";
  const data = JSON.parse(await readFile(jsonPath, "utf8")) as WhisperJson;
  return data.transcription
    .map((seg) => ({
      text: seg.text.trim(),
      start: seg.offsets.from / 1000,
      end: seg.offsets.to / 1000,
    }))
    .filter((c) => c.text.length > 0);
}

export function captionsPath(outPrefix: string): string {
  return path.resolve(outPrefix + ".captions.json");
}
