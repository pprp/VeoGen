import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

export interface ClipSegment {
  path: string;
  startSec?: number;
}

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

async function stitchClipPaths(clipPaths: string[], outputPath: string): Promise<void> {
  if (clipPaths.length === 0) {
    throw new Error("No clips available for stitching.");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const concatListPath = path.join(
    path.dirname(outputPath),
    `${path.basename(outputPath, path.extname(outputPath))}.concat.txt`,
  );

  const concatFile = clipPaths
    .map((clipPath) => `file '${escapeConcatPath(path.resolve(clipPath))}'`)
    .join("\n");

  await fs.writeFile(concatListPath, `${concatFile}\n`, "utf8");

  try {
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c",
      "copy",
      outputPath,
    ]);
  } catch {
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  }
}

async function trimClipSegment(segment: ClipSegment, outputPath: string): Promise<string> {
  if (!segment.startSec || segment.startSec <= 0) {
    return segment.path;
  }

  await runFfmpeg([
    "-y",
    "-ss",
    String(segment.startSec),
    "-i",
    segment.path,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    outputPath,
  ]);

  return outputPath;
}

export async function stitchVideoSegments(segments: ClipSegment[], outputPath: string): Promise<void> {
  if (segments.length === 0) {
    throw new Error("No clips available for stitching.");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const preparedClipPaths: string[] = [];
  for (const [index, segment] of segments.entries()) {
    const trimmedPath = path.join(
      path.dirname(outputPath),
      "prepared-clips",
      `${String(index + 1).padStart(2, "0")}-${path.basename(segment.path)}`,
    );
    await fs.mkdir(path.dirname(trimmedPath), { recursive: true });
    preparedClipPaths.push(await trimClipSegment(segment, trimmedPath));
  }

  await stitchClipPaths(preparedClipPaths, outputPath);
}

export async function stitchVideos(clipPaths: string[], outputPath: string): Promise<void> {
  await stitchClipPaths(clipPaths, outputPath);
}
