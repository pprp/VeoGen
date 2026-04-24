import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

import { stitchVideoSegments } from "../src/stitch.js";

const execFileAsync = promisify(execFile);

async function hasCommand(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function makeColorClip(filePath: string, color: string, durationSec: number): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=160x90:d=${durationSec}:r=24`,
    "-f",
    "lavfi",
    "-i",
    `anullsrc=channel_layout=stereo:sample_rate=44100:d=${durationSec}`,
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    filePath,
  ]);
}

async function getDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    filePath,
  ]);

  return Number(stdout.trim());
}

test("stitchVideoSegments trims extension segment prefixes before concatenation", async (t) => {
  if (!(await hasCommand("ffmpeg")) || !(await hasCommand("ffprobe"))) {
    t.skip("ffmpeg/ffprobe are required for stitch verification.");
    return;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "veogen-stitch-"));
  const introPath = path.join(tmpDir, "intro.mp4");
  const extensionPath = path.join(tmpDir, "extension-includes-intro.mp4");
  const outputPath = path.join(tmpDir, "stitched.mp4");

  await makeColorClip(introPath, "blue", 1);
  await makeColorClip(extensionPath, "red", 2);

  await stitchVideoSegments(
    [
      { path: introPath },
      { path: extensionPath, startSec: 1 },
    ],
    outputPath,
  );

  const durationSec = await getDurationSec(outputPath);
  assert.ok(durationSec > 1.8 && durationSec < 2.4, `expected about 2s, received ${durationSec}s`);
});
