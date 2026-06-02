import { writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ensureDir } from "../lib";
import { pushJob, waitForResult, pullResult, cleanupJob } from "../bridge/drive";

/**
 * Remote GPU stage: hand off script + face image to the Colab worker via the
 * Drive bus, wait for it to produce narration audio (Fishaudio) and the
 * lip-synced talking-head video (LTX-2.3), then pull both back.
 *
 * This bundles pipeline steps [1] 音声生成 and [2] リップシンク into one round-trip.
 */
export type ColabJobSpec = {
  jobId: string;
  scriptText: string;
  facePath: string; // absolute path to portrait image
  voiceRef?: string; // optional absolute path to reference voice wav for cloning
  workDir: string; // local work dir for this run
  keepRemote?: boolean; // skip cleanup (debugging)
};

export type ColabResult = {
  audio: string; // absolute path to narration.wav
  video: string; // absolute path to talking.mp4
};

export async function runColabStage(spec: ColabJobSpec): Promise<ColabResult> {
  const stage = await ensureDir(path.join(spec.workDir, "colab-inbox"));

  // Assemble the job payload the Colab worker expects.
  await writeFile(path.join(stage, "script.txt"), spec.scriptText, "utf8");
  const faceExt = path.extname(spec.facePath).toLowerCase() || ".png";
  await copyFile(spec.facePath, path.join(stage, `face${faceExt}`));
  if (spec.voiceRef && existsSync(spec.voiceRef)) {
    await copyFile(spec.voiceRef, path.join(stage, "voice_ref.wav"));
  }
  await writeFile(
    path.join(stage, "job.json"),
    JSON.stringify(
      {
        jobId: spec.jobId,
        face: `face${faceExt}`,
        script: "script.txt",
        voiceRef: spec.voiceRef ? "voice_ref.wav" : null,
        wants: ["narration.wav", "talking.mp4"],
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`☁️  Colab へジョブ送信: ${spec.jobId}`);
  await pushJob(spec.jobId, stage);

  await waitForResult(spec.jobId);

  const outDir = await ensureDir(path.join(spec.workDir, "colab-outbox"));
  await pullResult(spec.jobId, outDir);

  const audio = path.join(outDir, "narration.wav");
  const video = path.join(outDir, "talking.mp4");
  if (!existsSync(audio)) throw new Error(`Colab 出力に narration.wav がありません: ${audio}`);
  if (!existsSync(video)) throw new Error(`Colab 出力に talking.mp4 がありません: ${video}`);

  if (!spec.keepRemote) await cleanupJob(spec.jobId);
  return { audio, video };
}
