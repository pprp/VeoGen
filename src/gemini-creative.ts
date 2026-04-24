import path from "node:path";
import { promises as fs } from "node:fs";

import { EditMode, GoogleGenAI, Modality, RawReferenceImage, StyleReferenceImage } from "@google/genai";

import { detectMimeType, readFileBase64 } from "./utils.js";

export interface StructuredOutputRequest {
  model: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
}

export interface ImageAnalysisRequest {
  model: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  imagePaths: string[];
}

export interface GenerateImageRequest {
  model: string;
  prompt: string;
  outputPath: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
}

export interface EditImageRequest {
  model: string;
  prompt: string;
  outputPath: string;
  baseImagePath: string;
  styleImagePath: string;
  styleDescription?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
}

export interface GeminiCreativeLikeClient {
  generateStructuredOutput<T>(request: StructuredOutputRequest): Promise<T>;
  analyzeImages<T>(request: ImageAnalysisRequest): Promise<T>;
  generateImage(request: GenerateImageRequest): Promise<string>;
  editImage?(request: EditImageRequest): Promise<string>;
}

function stripCodeFences(input: string): string {
  const match = input.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : input.trim();
}

function parseStructuredText<T>(text: string | undefined): T {
  if (!text || text.trim().length === 0) {
    throw new Error("Gemini response did not contain any text output.");
  }

  return JSON.parse(stripCodeFences(text)) as T;
}

async function toInlineImagePart(filePath: string): Promise<{
  inlineData: {
    mimeType: string;
    data: string;
  };
}> {
  return {
    inlineData: {
      mimeType: detectMimeType(filePath),
      data: await readFileBase64(filePath),
    },
  };
}

async function toGeminiImage(filePath: string): Promise<{
  imageBytes: string;
  mimeType: string;
}> {
  return {
    imageBytes: await readFileBase64(filePath),
    mimeType: detectMimeType(filePath),
  };
}

function sizeToAspectRatio(size: GenerateImageRequest["size"]): "1:1" | "3:4" | "4:3" {
  switch (size) {
    case "1024x1536":
      return "3:4";
    case "1536x1024":
      return "4:3";
    default:
      return "1:1";
  }
}

function isGeminiNativeImageModel(model: string): boolean {
  return /^gemini-/i.test(model) && /image/i.test(model);
}

function extractInlineImageBytes(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
        };
      }>;
    };
  }>;
}): string | undefined {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }
  }

  return undefined;
}

export class GeminiCreativeClient implements GeminiCreativeLikeClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateStructuredOutput<T>(request: StructuredOutputRequest): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: request.model,
      contents: [
        {
          role: "user",
          parts: [{ text: request.userPrompt }],
        },
      ],
      config: {
        systemInstruction: request.systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: request.schema,
      },
    });

    return parseStructuredText<T>(response.text);
  }

  async analyzeImages<T>(request: ImageAnalysisRequest): Promise<T> {
    const imageParts = await Promise.all(request.imagePaths.map((imagePath) => toInlineImagePart(imagePath)));
    const response = await this.ai.models.generateContent({
      model: request.model,
      contents: [
        {
          role: "user",
          parts: [{ text: request.userPrompt }, ...imageParts],
        },
      ],
      config: {
        systemInstruction: request.systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: request.schema,
      },
    });

    return parseStructuredText<T>(response.text);
  }

  async generateImage(request: GenerateImageRequest): Promise<string> {
    if (isGeminiNativeImageModel(request.model)) {
      const response = await this.ai.models.generateContent({
        model: request.model,
        contents: [
          {
            role: "user",
            parts: [{ text: request.prompt }],
          },
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: sizeToAspectRatio(request.size),
          },
        },
      });

      const imageBytes = extractInlineImageBytes(response);
      if (!imageBytes) {
        throw new Error("Gemini image generation response did not contain image bytes.");
      }

      await fs.mkdir(path.dirname(request.outputPath), { recursive: true });
      await fs.writeFile(request.outputPath, Buffer.from(imageBytes, "base64"));
      return request.outputPath;
    }

    const response = await this.ai.models.generateImages({
      model: request.model,
      prompt: request.prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: sizeToAspectRatio(request.size),
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      throw new Error("Gemini image generation response did not contain image bytes.");
    }

    await fs.mkdir(path.dirname(request.outputPath), { recursive: true });
    await fs.writeFile(request.outputPath, Buffer.from(imageBytes, "base64"));
    return request.outputPath;
  }

  async editImage(request: EditImageRequest): Promise<string> {
    if (isGeminiNativeImageModel(request.model)) {
      const imagePaths = request.baseImagePath === request.styleImagePath
        ? [request.baseImagePath]
        : [request.baseImagePath, request.styleImagePath];
      const imageParts = await Promise.all(imagePaths.map((imagePath) => toInlineImagePart(imagePath)));
      const response = await this.ai.models.generateContent({
        model: request.model,
        contents: [
          {
            role: "user",
            parts: [{ text: request.prompt }, ...imageParts],
          },
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: sizeToAspectRatio(request.size),
          },
        },
      });

      const imageBytes = extractInlineImageBytes(response);
      if (!imageBytes) {
        throw new Error("Gemini image editing response did not contain image bytes.");
      }

      await fs.mkdir(path.dirname(request.outputPath), { recursive: true });
      await fs.writeFile(request.outputPath, Buffer.from(imageBytes, "base64"));
      return request.outputPath;
    }

    const rawReferenceImage = new RawReferenceImage();
    rawReferenceImage.referenceImage = await toGeminiImage(request.baseImagePath);

    const styleReferenceImage = new StyleReferenceImage();
    styleReferenceImage.referenceImage = await toGeminiImage(request.styleImagePath);
    styleReferenceImage.config = {
      styleDescription: request.styleDescription,
    };

    const response = await this.ai.models.editImage({
      model: request.model,
      prompt: request.prompt,
      referenceImages: [rawReferenceImage, styleReferenceImage],
      config: {
        numberOfImages: 1,
        aspectRatio: sizeToAspectRatio(request.size),
        editMode: EditMode.EDIT_MODE_STYLE,
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      throw new Error("Gemini image editing response did not contain image bytes.");
    }

    await fs.mkdir(path.dirname(request.outputPath), { recursive: true });
    await fs.writeFile(request.outputPath, Buffer.from(imageBytes, "base64"));
    return request.outputPath;
  }
}
