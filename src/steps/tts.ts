import path from "node:path";
import { run, probeDuration } from "../lib";

/**
 * Phase 0 (local placeholder): synthesize narration with macOS `say` (voice Kyoko),
 * then transcode to 16kHz mono WAV (the format Whisper wants).
 *
 * Phase 1 will replace this with Fishaudio / fish-speech output pulled from Colab.
 * The contract is identical: text in -> 16kHz mono WAV out + duration in seconds.
 */
export async function synthSayJa(
  text: string,
  outWav: string,
  voice = "Kyoko",
): Promise<{ wav: string; durationSec: number }> {
  const aiff = outWav.replace(/\.wav$/, "") + ".raw.aiff";
  // `say` reads the text via argument; collapse newlines so it reads as continuous narration.
  const flat = text.replace(/\s*\n\s*/g, " ").trim();
  await run("say", ["-v", voice, "-o", aiff, flat]);
  await run("ffmpeg", [
    "-y",
    "-i",
    aiff,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    outWav,
  ]);
  const durationSec = await probeDuration(outWav);
  return { wav: path.resolve(outWav), durationSec };
}
