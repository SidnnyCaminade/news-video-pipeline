import { run } from "../lib";

/**
 * Google Drive bus via rclone. Mac (orchestrator) and Colab (GPU worker)
 * exchange files through a shared Drive folder. No API keys in our code —
 * rclone holds the OAuth token (configure once: `rclone config`, remote name e.g. "gdrive").
 *
 * Layout under <remote base>:
 *   inbox/<jobId>/   ← Mac uploads job inputs (script.txt, face.png, job.json)
 *   outbox/<jobId>/  ← Colab writes results (narration.wav, talking.mp4, done.json)
 *
 * The Colab notebooks watch inbox/, process, and write outbox/.../done.json last.
 */

const REMOTE = process.env.RCLONE_REMOTE ?? "gdrive:news-video-pipeline";

export function inboxPath(jobId: string): string {
  return `${REMOTE}/inbox/${jobId}`;
}
export function outboxPath(jobId: string): string {
  return `${REMOTE}/outbox/${jobId}`;
}

/** Upload a local directory's contents to inbox/<jobId>. */
export async function pushJob(jobId: string, localDir: string): Promise<void> {
  await run("rclone", ["copy", localDir, inboxPath(jobId), "--progress"]);
}

/** List filenames present in outbox/<jobId> (empty if folder doesn't exist yet). */
async function outboxFiles(jobId: string): Promise<string[]> {
  try {
    const { stdout } = await run("rclone", ["lsf", outboxPath(jobId)], { quiet: true });
    return stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll outbox/<jobId> until `done.json` appears (Colab writes it last),
 * then return the list of result files. Throws on timeout.
 */
export async function waitForResult(
  jobId: string,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<string[]> {
  const timeoutMs = opts.timeoutMs ?? 30 * 60 * 1000; // 30 min
  const pollMs = opts.pollMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = await outboxFiles(jobId);
    if (files.includes("done.json")) return files;
    const mins = Math.round((deadline - Date.now()) / 60000);
    process.stdout.write(`\r⏳ Colab 処理待ち... (残り最大 ${mins} 分, files: ${files.length})   `);
    await sleep(pollMs);
  }
  process.stdout.write("\n");
  throw new Error(`Colab の結果がタイムアウトしました (job ${jobId})`);
}

/** Download outbox/<jobId> into a local directory. */
export async function pullResult(jobId: string, destDir: string): Promise<void> {
  process.stdout.write("\n");
  await run("rclone", ["copy", outboxPath(jobId), destDir, "--progress"]);
}

/** Remove inbox+outbox folders for a job (cleanup after success). */
export async function cleanupJob(jobId: string): Promise<void> {
  for (const p of [inboxPath(jobId), outboxPath(jobId)]) {
    try {
      await run("rclone", ["purge", p], { quiet: true });
    } catch {
      /* ignore */
    }
  }
}
