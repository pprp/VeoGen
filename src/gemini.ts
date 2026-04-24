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
const UNSUPPORTED_GENERATE_AUDIO_ERROR = "generateAudio parameter is not supported in Gemini API.";
const UNSUPPORTED_ENHANCE_PROMPT_ERROR = "`enhancePrompt` isn't supported by this model.";
const UNSUPPORTED_NEGATIVE_PROMPT_ERROR = "Negative prompt is not supported in your use case.";
const UNSUPPORTED_PERSON_GENERATION_ERROR = "for personGeneration is currently not supported.";
const UNSUPPORTED_SEED_ERROR = "seed parameter is not supported in Gemini API.";

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
  personGeneration: "allow_adult" | "dont_allow";
  enhancePrompt: boolean;
  generateAudio: boolean;
  negativePrompt?: string;
  seed?: number;
  pollMs: number;
  referenceImages: ReferenceImageInput[];
  previousVideoPath?: string;
  previousVideoUri?: string;
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

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause ? String(error.cause) : "";
  return `${message}\n${cause}`;
}

function isTransientNetworkError(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes("fetch failed") ||
    text.includes("terminated") ||
    text.includes("ECONNRESET") ||
    text.includes("UND_ERR_SOCKET") ||
    text.includes("other side closed")
  );
}

async function withRateLimitBackoff<T>(task: () => Promise<T>): Promise<T> {
  let delayMs = RATE_LIMIT_RETRY_BASE_MS;

  for (let attempt = 1; attempt <= RATE_LIMIT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const rateLimited = isRateLimitError(error);
      if (
        attempt === RATE_LIMIT_RETRY_ATTEMPTS ||
        (!rateLimited && !isTransientNetworkError(error))
      ) {
        throw error;
      }

      await sleep(rateLimited ? delayMs : 10_000);
      if (rateLimited) {
        delayMs = Math.min(delayMs * 2, RATE_LIMIT_RETRY_MAX_MS);
      }
    }
  }

  throw new Error("Rate-limit retry loop exited unexpectedly.");
}

function isUnsupportedGenerateAudioError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(UNSUPPORTED_GENERATE_AUDIO_ERROR);
}

function isUnsupportedEnhancePromptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(UNSUPPORTED_ENHANCE_PROMPT_ERROR);
}

function isUnsupportedNegativePromptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(UNSUPPORTED_NEGATIVE_PROMPT_ERROR);
}

function isUnsupportedPersonGenerationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(UNSUPPORTED_PERSON_GENERATION_ERROR);
}

function isUnsupportedSeedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(UNSUPPORTED_SEED_ERROR);
}

async function buildSourceVideo(previousVideoPath: string) {
  return {
    videoBytes: await readFileBase64(previousVideoPath),
    mimeType: detectMimeType(previousVideoPath),
  };
}

function buildSourceVideoUri(previousVideoUri: string) {
  return {
    uri: previousVideoUri,
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
  apiKey: string,
): Promise<void> {
  const remoteUri = generatedVideo.video?.uri;
  if (remoteUri) {
    try {
      await withRateLimitBackoff(async () => {
        const response = await fetch(remoteUri, {
          headers: {
            "x-goog-api-key": apiKey,
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
      });
      return;
    } catch (error) {
      if (isRateLimitError(error) || isTransientNetworkError(error)) {
        throw error;
      }
    }
  }

  await withRateLimitBackoff(async () => {
    await ai.files.download({
      file: generatedVideo,
      downloadPath: outputPath,
    });
  });
}

export class GeminiVideoClient {
  private readonly ai: GoogleGenAI;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateClip(request: GenerateClipRequest): Promise<GenerateClipResult> {
    const source = request.previousVideoUri || request.previousVideoPath
      ? {
          prompt: request.prompt,
          video: request.previousVideoUri
            ? buildSourceVideoUri(request.previousVideoUri)
            : await buildSourceVideo(request.previousVideoPath as string),
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
      seed: request.seed,
      negativePrompt: request.negativePrompt,
      enhancePrompt: request.enhancePrompt,
      generateAudio: request.generateAudio,
    };

    if (!request.previousVideoPath && request.referenceImages.length > 0) {
      config.referenceImages = await buildReferenceImages(request.referenceImages);
    }

    const startOperation = async (currentConfig: GenerateVideosConfig) => {
      return withRateLimitBackoff(async () => {
        return this.ai.models.generateVideos({
          model: request.model,
          source,
          config: currentConfig,
        });
      });
    };

    const fallbackConfig = { ...config };
    let operation: GenerateVideosOperation;
    for (;;) {
      try {
        operation = await startOperation(fallbackConfig);
        break;
      } catch (error) {
        if ("generateAudio" in fallbackConfig && request.generateAudio && isUnsupportedGenerateAudioError(error)) {
          delete fallbackConfig.generateAudio;
          continue;
        }

        if ("enhancePrompt" in fallbackConfig && request.enhancePrompt && isUnsupportedEnhancePromptError(error)) {
          delete fallbackConfig.enhancePrompt;
          continue;
        }

        if ("negativePrompt" in fallbackConfig && request.negativePrompt && isUnsupportedNegativePromptError(error)) {
          delete fallbackConfig.negativePrompt;
          continue;
        }

        if (
          "personGeneration" in fallbackConfig &&
          request.personGeneration &&
          isUnsupportedPersonGenerationError(error)
        ) {
          delete fallbackConfig.personGeneration;
          continue;
        }

        if ("seed" in fallbackConfig && request.seed !== undefined && isUnsupportedSeedError(error)) {
          delete fallbackConfig.seed;
          continue;
        }

        throw error;
      }
    }

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

    await downloadVideo(this.ai, generatedVideo, request.outputPath, this.apiKey);

    return {
      operationName: operation.name,
      remoteUri,
      outputPath: request.outputPath,
    };
  }
}
