import path from "node:path";
import { promises as fs } from "node:fs";

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readFileBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString("base64");
}

export function formatIndex(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

export function safeSlug(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || "untitled";
}

export function resolveFromFile(baseFilePath: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.resolve(path.dirname(baseFilePath), targetPath);
}

export function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export function detectMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    default:
      throw new Error(`Unsupported media type for ${filePath}`);
  }
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function timestampId(date = new Date()): string {
  const year = date.getFullYear();
  const month = formatIndex(date.getMonth() + 1);
  const day = formatIndex(date.getDate());
  const hours = formatIndex(date.getHours());
  const minutes = formatIndex(date.getMinutes());
  const seconds = formatIndex(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function relativeToCwd(targetPath: string): string {
  return path.relative(process.cwd(), targetPath) || ".";
}

export function normalizeVeoModelName(model: string): string {
  switch (model.trim()) {
    case "veo-3.0-generate-preview":
      return "veo-3.1-generate-preview";
    case "veo-3.0-fast-generate-preview":
      return "veo-3.1-fast-generate-preview";
    default:
      return model;
  }
}
