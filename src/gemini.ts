import { promises as fs } from "node:fs";

import {
  GoogleGenAI,
  VideoGenerationReferenceType,
  type GenerateVideosConfig,
  type GeneratedVideo,
  type GenerateVideosOperation,
} from "@google/genai";

import type { ReferenceType } from "./types.js";
import { detectMimeType, readFileBase64, sleep } from "./utils.js";

const RATE_LIMIT_RETRY_BASE_MS = 60_000;
const RATE_LIMIT_RETRY_MAX_MS = 5 * 60_000;
const RATE_LIMIT_RETRY_ATTEMPTS = 6;

export interface ReferenceImageInput {
  absolutePath: string;
  referenceType: ReferenceType;
}

export interface GenerateClipRequest {
  model: string;
  prompt: string;
  outputPath: string;
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  resolution: "720p" | "1080p";
  personGeneration: "allow_adult" | "dont_allow" | "allow_all";
  enhancePrompt: boolean;
  generateAudio: boolean;
  negativePrompt?: string;
  seed?: number;
  pollMs: number;
  referenceImages: ReferenceImageInput[];
  previousVideoPath?: string;
}

export interface GenerateClipResult {
  operationName?: string;
  remoteUri?: string;
  outputPath: string;
}

function stringifyOperationError(operation: GenerateVideosOperation): string {
  if (!operation.error) {
    return "Video generation failed with an unknown error.";
  }

  try {
    return JSON.stringify(operation.error, null, 2);
  } catch {
    return String(operation.error);
  }
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('"code":429') || message.includes("RESOURCE_EXHAUSTED");
}

async function withRateLimitBackoff<T>(task: () => Promise<T>): Promise<T> {
  let delayMs = RATE_LIMIT_RETRY_BASE_MS;

  for (let attempt = 1; attempt <= RATE_LIMIT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt === RATE_LIMIT_RETRY_ATTEMPTS || !isRateLimitError(error)) {
        throw error;
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, RATE_LIMIT_RETRY_MAX_MS);
    }
  }

  throw new Error("Rate-limit retry loop exited unexpectedly.");
}

async function buildSourceVideo(previousVideoPath: string) {
  return {
    videoBytes: await readFileBase64(previousVideoPath),
    mimeType: detectMimeType(previousVideoPath),
  };
}

async function buildReferenceImages(referenceImages: ReferenceImageInput[]) {
  return Promise.all(
    referenceImages.map(async (referenceImage) => {
      return {
        image: {
          imageBytes: await readFileBase64(referenceImage.absolutePath),
          mimeType: detectMimeType(referenceImage.absolutePath),
        },
        referenceType:
          referenceImage.referenceType === "STYLE"
            ? VideoGenerationReferenceType.STYLE
            : VideoGenerationReferenceType.ASSET,
      };
    }),
  );
}

async function downloadVideo(
  ai: GoogleGenAI,
  generatedVideo: GeneratedVideo,
  outputPath: string,
): Promise<void> {
  try {
    await withRateLimitBackoff(async () => {
      await ai.files.download({
        file: generatedVideo,
        downloadPath: outputPath,
      });
    });
    return;
  } catch (error) {
    if (isRateLimitError(error)) {
      throw error;
    }

    const remoteUri = generatedVideo.video?.uri;
    if (!remoteUri) {
      throw error;
    }

    const response = await withRateLimitBackoff(async () => {
      return fetch(remoteUri);
    });
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  }
}

export class GeminiVideoClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateClip(request: GenerateClipRequest): Promise<GenerateClipResult> {
    const source = request.previousVideoPath
      ? {
          prompt: request.prompt,
          video: await buildSourceVideo(request.previousVideoPath),
        }
      : {
          prompt: request.prompt,
        };

    const config: GenerateVideosConfig = {
      numberOfVideos: 1,
      durationSeconds: request.durationSec,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
      personGeneration: request.personGeneration,
    };

    if (!request.previousVideoPath && request.referenceImages.length > 0) {
      config.referenceImages = await buildReferenceImages(request.referenceImages);
    }

    let operation = await withRateLimitBackoff(async () => {
      return this.ai.models.generateVideos({
        model: request.model,
        source,
        config,
      });
    });

    while (!operation.done) {
      await sleep(request.pollMs);
      operation = await withRateLimitBackoff(async () => {
        return this.ai.operations.getVideosOperation({ operation });
      });
    }

    if (operation.error) {
      throw new Error(stringifyOperationError(operation));
    }

    const generatedVideo = operation.response?.generatedVideos?.[0];
    if (!generatedVideo) {
      throw new Error("Video generation completed without a generated video payload.");
    }

    const remoteUri = generatedVideo.video?.uri;

    await downloadVideo(this.ai, generatedVideo, request.outputPath);

    return {
      operationName: operation.name,
      remoteUri,
      outputPath: request.outputPath,
    };
  }
}
