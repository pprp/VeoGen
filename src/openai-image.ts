import path from "node:path";
import { promises as fs } from "node:fs";

import type { GenerateImageRequest, GeminiCreativeLikeClient } from "./gemini-creative.js";

interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
}

export class OpenAIImageClient implements Pick<GeminiCreativeLikeClient, "generateImage"> {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  ) {}

  async generateImage(request: GenerateImageRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        n: 1,
        size: request.size ?? "1024x1024",
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI image generation failed: ${response.status} ${response.statusText} ${responseText}`);
    }

    const payload = JSON.parse(responseText) as OpenAIImageResponse;
    const firstImage = payload.data?.[0];
    if (!firstImage?.b64_json && !firstImage?.url) {
      throw new Error("OpenAI image generation response did not contain b64_json or url output.");
    }

    await fs.mkdir(path.dirname(request.outputPath), { recursive: true });

    if (firstImage.b64_json) {
      await fs.writeFile(request.outputPath, Buffer.from(firstImage.b64_json, "base64"));
      return request.outputPath;
    }

    const imageResponse = await fetch(firstImage.url as string);
    if (!imageResponse.ok) {
      throw new Error(`OpenAI image download failed: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    const imageBytes = await imageResponse.arrayBuffer();
    await fs.writeFile(request.outputPath, Buffer.from(imageBytes));
    return request.outputPath;
  }
}
