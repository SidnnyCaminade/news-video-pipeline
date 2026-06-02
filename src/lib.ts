import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const ROOT = path.resolve(import.meta.dir, "..");
export const PUBLIC_DIR = path.join(ROOT, "remotion", "public");
export const WORK_DIR = path.join(ROOT, "work");

/** Run a command, streaming output. Rejects on non-zero exit. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; quiet?: boolean } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd ?? ROOT });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
      if (!opts.quiet) process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      if (!opts.quiet) process.stderr.write(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

/** Audio/video duration in seconds via ffprobe. */
export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { quiet: true },
  );
  const d = parseFloat(stdout.trim());
  if (!isFinite(d)) throw new Error(`ffprobe could not read duration of ${file}`);
  return d;
}

export async function ensureDir(p: string): Promise<string> {
  await mkdir(p, { recursive: true });
  return p;
}

/** Expand a leading ~ to the home directory. */
export function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

export type Caption = { text: string; start: number; end: number };
