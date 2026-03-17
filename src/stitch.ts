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

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

export async function stitchVideos(clipPaths: string[], outputPath: string): Promise<void> {
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
