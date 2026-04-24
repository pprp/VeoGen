import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import { OpenAIImageClient } from "../src/openai-image.js";

test("OpenAIImageClient writes b64 image output from the images API", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "veogen-openai-image-"));
  const outputPath = path.join(tmpDir, "reference.png");
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        data: [
          {
            b64_json: Buffer.from("image-bytes").toString("base64"),
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const client = new OpenAIImageClient("test-key");
    await client.generateImage({
      model: "gpt-image-2",
      prompt: "cinematic mother and child reference image",
      outputPath,
      size: "1024x1536",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(capturedBody, {
    model: "gpt-image-2",
    prompt: "cinematic mother and child reference image",
    n: 1,
    size: "1024x1536",
  });
  assert.equal(await fs.readFile(outputPath, "utf8"), "image-bytes");
});
