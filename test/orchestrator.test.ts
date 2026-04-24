import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";

import { buildRenderPlan, renderProject } from "../src/orchestrator.js";
import { GeminiVideoClient } from "../src/gemini.js";
import { normalizeVeoModelName } from "../src/utils.js";

const execFileAsync = promisify(execFile);

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

test("renderProject preserves supported personGeneration values from frontmatter", async () => {
  const tmpDir = await makeTempDir("veogen-render-");
  const scriptPath = path.join(tmpDir, "script.md");
  const outputDir = path.join(tmpDir, "run");
  await writeFile(
    scriptPath,
    [
      "---",
      "title: Person Policy",
      "personGeneration: dont_allow",
      "defaultClipDurationSec: 5",
      "---",
      "# Scene 1",
      "",
      "## Shot 1",
      "Static product-only scene.",
      "",
    ].join("\n"),
  );

  const originalGenerateClip = GeminiVideoClient.prototype.generateClip;
  const requests: Array<{ personGeneration: string }> = [];

  GeminiVideoClient.prototype.generateClip = async function mockGenerateClip(request) {
    requests.push({ personGeneration: request.personGeneration });
    await fs.mkdir(path.dirname(request.outputPath), { recursive: true });
    await fs.writeFile(request.outputPath, "video");
    return {
      operationName: "op-1",
      outputPath: request.outputPath,
      remoteUri: "https://example.com/video.mp4",
    };
  };

  try {
    await renderProject({
      scriptPath,
      outputDir,
      apiKey: "test-key",
      skipStitch: true,
      interShotDelayMs: 0,
      pollMs: 1,
    });
  } finally {
    GeminiVideoClient.prototype.generateClip = originalGenerateClip;
  }

  assert.equal(requests.length, 1);
  assert.equal(requests[0].personGeneration, "dont_allow");
});

test("GeminiVideoClient forwards render config fields into GenerateVideosConfig", async () => {
  const tmpDir = await makeTempDir("veogen-client-");
  const outputPath = path.join(tmpDir, "clip.mp4");
  const client = new GeminiVideoClient("test-key");
  let capturedRequest: { config?: Record<string, unknown> } | undefined;

  (client as unknown as { ai: unknown }).ai = {
    files: {
      async download({ downloadPath }: { downloadPath: string }) {
        await fs.writeFile(downloadPath, "video");
      },
    },
    models: {
      async generateVideos(request: { config?: Record<string, unknown> }) {
        capturedRequest = request;
        return {
          done: true,
          name: "op-1",
          response: {
            generatedVideos: [{ video: { uri: "https://example.com/video.mp4" } }],
          },
        };
      },
    },
    operations: {
      async getVideosOperation() {
        throw new Error("unexpected polling");
      },
    },
  };

  await client.generateClip({
    model: "veo-3.1-generate-preview",
    prompt: "test prompt",
    outputPath,
    durationSec: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    personGeneration: "allow_adult",
    enhancePrompt: false,
    generateAudio: false,
    negativePrompt: "no subtitles",
    seed: 42,
    pollMs: 1,
    referenceImages: [],
  });

  assert.ok(capturedRequest);
  assert.deepEqual(capturedRequest.config, {
    numberOfVideos: 1,
    durationSeconds: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    personGeneration: "allow_adult",
    seed: 42,
    negativePrompt: "no subtitles",
    enhancePrompt: false,
    generateAudio: false,
  });
});

test("GeminiVideoClient uses previous remote video URI for extension requests", async () => {
  const tmpDir = await makeTempDir("veogen-client-video-uri-");
  const outputPath = path.join(tmpDir, "clip.mp4");
  const client = new GeminiVideoClient("test-key");
  let capturedRequest: { source?: { video?: { uri?: string; videoBytes?: string; mimeType?: string } } } | undefined;

  (client as unknown as { ai: unknown }).ai = {
    files: {
      async download({ downloadPath }: { downloadPath: string }) {
        await fs.writeFile(downloadPath, "video");
      },
    },
    models: {
      async generateVideos(request: { source?: { video?: { uri?: string; videoBytes?: string; mimeType?: string } } }) {
        capturedRequest = request;
        return {
          done: true,
          name: "op-1",
          response: {
            generatedVideos: [{ video: { uri: "https://example.com/next.mp4" } }],
          },
        };
      },
    },
    operations: {
      async getVideosOperation() {
        throw new Error("unexpected polling");
      },
    },
  };

  await client.generateClip({
    model: "veo-3.1-generate-preview",
    prompt: "extend prompt",
    outputPath,
    durationSec: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    personGeneration: "allow_adult",
    enhancePrompt: false,
    generateAudio: false,
    pollMs: 1,
    referenceImages: [],
    previousVideoPath: path.join(tmpDir, "previous.mp4"),
    previousVideoUri: "https://example.com/previous.mp4",
  });

  assert.equal(capturedRequest?.source?.video?.uri, "https://example.com/previous.mp4");
  assert.equal("videoBytes" in (capturedRequest?.source?.video ?? {}), false);
  assert.equal("mimeType" in (capturedRequest?.source?.video ?? {}), false);
});

test("GeminiVideoClient retries without generateAudio when Gemini API rejects that field", async () => {
  const tmpDir = await makeTempDir("veogen-client-audio-retry-");
  const outputPath = path.join(tmpDir, "clip.mp4");
  const client = new GeminiVideoClient("test-key");
  const requests: Array<{ config?: Record<string, unknown> }> = [];

  (client as unknown as { ai: unknown }).ai = {
    files: {
      async download({ downloadPath }: { downloadPath: string }) {
        await fs.writeFile(downloadPath, "video");
      },
    },
    models: {
      async generateVideos(request: { config?: Record<string, unknown> }) {
        requests.push({
          ...request,
          config: request.config ? { ...request.config } : undefined,
        });
        if (requests.length === 1) {
          throw new Error("generateAudio parameter is not supported in Gemini API.");
        }

        return {
          done: true,
          name: "op-1",
          response: {
            generatedVideos: [{ video: { uri: "https://example.com/video.mp4" } }],
          },
        };
      },
    },
    operations: {
      async getVideosOperation() {
        throw new Error("unexpected polling");
      },
    },
  };

  await client.generateClip({
    model: "veo-3.1-generate-preview",
    prompt: "test prompt",
    outputPath,
    durationSec: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    personGeneration: "allow_adult",
    enhancePrompt: true,
    generateAudio: true,
    negativePrompt: "no subtitles",
    seed: 42,
    pollMs: 1,
    referenceImages: [],
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].config?.generateAudio, true);
  assert.equal("generateAudio" in (requests[1].config ?? {}), false);
});

test("GeminiVideoClient retries without enhancePrompt when the model rejects that field", async () => {
  const tmpDir = await makeTempDir("veogen-client-enhance-retry-");
  const outputPath = path.join(tmpDir, "clip.mp4");
  const client = new GeminiVideoClient("test-key");
  const requests: Array<{ config?: Record<string, unknown> }> = [];

  (client as unknown as { ai: unknown }).ai = {
    files: {
      async download({ downloadPath }: { downloadPath: string }) {
        await fs.writeFile(downloadPath, "video");
      },
    },
    models: {
      async generateVideos(request: { config?: Record<string, unknown> }) {
        requests.push({
          ...request,
          config: request.config ? { ...request.config } : undefined,
        });
        if (requests.length === 1) {
          throw new Error("`enhancePrompt` isn't supported by this model.");
        }

        return {
          done: true,
          name: "op-1",
          response: {
            generatedVideos: [{ video: { uri: "https://example.com/video.mp4" } }],
          },
        };
      },
    },
    operations: {
      async getVideosOperation() {
        throw new Error("unexpected polling");
      },
    },
  };

  await client.generateClip({
    model: "veo-3.1-generate-preview",
    prompt: "test prompt",
    outputPath,
    durationSec: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    personGeneration: "allow_adult",
    enhancePrompt: true,
    generateAudio: false,
    negativePrompt: "no subtitles",
    seed: 42,
    pollMs: 1,
    referenceImages: [],
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].config?.enhancePrompt, true);
  assert.equal("enhancePrompt" in (requests[1].config ?? {}), false);
});

test("GeminiVideoClient retries without negativePrompt when the use case rejects that field", async () => {
  const tmpDir = await makeTempDir("veogen-client-negative-retry-");
  const outputPath = path.join(tmpDir, "clip.mp4");
  const client = new GeminiVideoClient("test-key");
  const requests: Array<{ config?: Record<string, unknown> }> = [];

  (client as unknown as { ai: unknown }).ai = {
    files: {
      async download({ downloadPath }: { downloadPath: string }) {
        await fs.writeFile(downloadPath, "video");
      },
    },
    models: {
      async generateVideos(request: { config?: Record<string, unknown> }) {
        requests.push({
          ...request,
          config: request.config ? { ...request.config } : undefined,
        });
        if (requests.length === 1) {
          throw new Error("Negative prompt is not supported in your use case.");
        }

        return {
          done: true,
          name: "op-1",
          response: {
            generatedVideos: [{ video: { uri: "https://example.com/video.mp4" } }],
          },
        };
      },
    },
    operations: {
      async getVideosOperation() {
        throw new Error("unexpected polling");
      },
    },
  };

  await client.generateClip({
    model: "veo-3.1-generate-preview",
    prompt: "test prompt",
    outputPath,
    durationSec: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    personGeneration: "allow_adult",
    enhancePrompt: false,
    generateAudio: false,
    negativePrompt: "no subtitles",
    seed: 42,
    pollMs: 1,
    referenceImages: [],
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].config?.negativePrompt, "no subtitles");
  assert.equal("negativePrompt" in (requests[1].config ?? {}), false);
});

test("GeminiVideoClient retries without personGeneration when the model rejects that field", async () => {
  const tmpDir = await makeTempDir("veogen-client-person-generation-retry-");
  const outputPath = path.join(tmpDir, "clip.mp4");
  const client = new GeminiVideoClient("test-key");
  const requests: Array<{ config?: Record<string, unknown> }> = [];

  (client as unknown as { ai: unknown }).ai = {
    files: {
      async download({ downloadPath }: { downloadPath: string }) {
        await fs.writeFile(downloadPath, "video");
      },
    },
    models: {
      async generateVideos(request: { config?: Record<string, unknown> }) {
        requests.push({
          ...request,
          config: request.config ? { ...request.config } : undefined,
        });
        if (requests.length === 1) {
          throw new Error("allow_adult for personGeneration is currently not supported.");
        }

        return {
          done: true,
          name: "op-1",
          response: {
            generatedVideos: [{ video: { uri: "https://example.com/video.mp4" } }],
          },
        };
      },
    },
    operations: {
      async getVideosOperation() {
        throw new Error("unexpected polling");
      },
    },
  };

  await client.generateClip({
    model: "veo-3.1-generate-preview",
    prompt: "test prompt",
    outputPath,
    durationSec: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    personGeneration: "allow_adult",
    enhancePrompt: false,
    generateAudio: false,
    negativePrompt: undefined,
    seed: 42,
    pollMs: 1,
    referenceImages: [],
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].config?.personGeneration, "allow_adult");
  assert.equal("personGeneration" in (requests[1].config ?? {}), false);
});

test("reference selection keeps asset references ahead of optional style references", async () => {
  const tmpDir = await makeTempDir("veogen-plan-");
  const refsDir = path.join(tmpDir, "refs");
  for (const name of ["char-a.jpg", "char-b.jpg", "shot.jpg", "style.jpg"]) {
    await writeFile(path.join(refsDir, name), name);
  }

  const scriptPath = path.join(tmpDir, "script.md");
  await writeFile(
    scriptPath,
    [
      "---",
      "title: Ref Budget",
      "styleReferenceImages:",
      "  - refs/style.jpg",
      "characters:",
      "  - id: hero",
      "    name: Hero",
      "    description: Main character",
      "    referenceImages:",
      "      - refs/char-a.jpg",
      "      - refs/char-b.jpg",
      "---",
      "# Scene 1",
      "",
      "## Shot 1",
      "```yaml",
      "characters: [hero]",
      "references:",
      "  - refs/shot.jpg",
      "```",
      "Hero enters the room.",
      "",
    ].join("\n"),
  );

  const plan = await buildRenderPlan({
    scriptPath,
    outputDir: path.join(tmpDir, "run"),
  });

  assert.equal(plan.shots.length, 1);
  assert.deepEqual(
    plan.shots[0].selectedReferences.map((reference) => path.basename(reference.sourcePath)),
    ["char-a.jpg", "char-b.jpg", "shot.jpg"],
  );
  assert.deepEqual(
    plan.shots[0].droppedReferences.map((reference) => path.basename(reference.sourcePath)),
    ["style.jpg"],
  );
});

test("1080p continueFromPrevious falls back to referenced text-to-video", async () => {
  const tmpDir = await makeTempDir("veogen-plan-extension-");
  const refsDir = path.join(tmpDir, "refs");
  await writeFile(path.join(refsDir, "hero.jpg"), "hero");
  const scriptPath = path.join(tmpDir, "script.md");

  await writeFile(
    scriptPath,
    [
      "---",
      "title: Extension Guard",
      "resolution: 1080p",
      "characters:",
      "  - id: hero",
      "    name: Hero",
      "    description: Main character",
      "    referenceImages:",
      "      - refs/hero.jpg",
      "---",
      "# Scene 1",
      "",
      "## Shot 1",
      "```yaml",
      "characters: [hero]",
      "```",
      "Hero starts moving.",
      "",
      "## Shot 2",
      "```yaml",
      "characters: [hero]",
      "continueFromPrevious: true",
      "```",
      "Hero continues the same motion.",
      "",
    ].join("\n"),
  );

  const plan = await buildRenderPlan({
    scriptPath,
    outputDir: path.join(tmpDir, "run"),
  });

  assert.equal(plan.shots[1].mode, "text-to-video");
  assert.deepEqual(
    plan.shots[1].selectedReferences.map((reference) => path.basename(reference.sourcePath)),
    ["hero.jpg"],
  );
  assert.ok(
    plan.warnings.some((warning) =>
      /continueFromPrevious was downgraded to text-to-video because Gemini video extension currently requires 720p/.test(warning),
    ),
  );
});

test("bundled minimal example script plans without any missing reference warnings", async () => {
  const tmpDir = await makeTempDir("veogen-example-");
  const plan = await buildRenderPlan({
    scriptPath: path.resolve("projs/examples/demo-short.min.md"),
    outputDir: path.join(tmpDir, "run"),
  });

  const missingReferenceWarnings = plan.shots
    .flatMap((shot) => shot.warnings)
    .filter((warning) => warning.includes("missing reference image"));

  assert.deepEqual(missingReferenceWarnings, []);
});

test("README quick start points to the self-contained minimal example", async () => {
  const [readmeEn, readmeZh] = await Promise.all([
    fs.readFile(path.resolve("README.md"), "utf8"),
    fs.readFile(path.resolve("README.zh-CN.md"), "utf8"),
  ]);

  assert.match(readmeEn, /projs\/examples\/demo-short\.min\.md/);
  assert.match(readmeZh, /projs\/examples\/demo-short\.min\.md/);
  assert.doesNotMatch(
    readmeEn,
    /Start with \[`projs\/examples\/demo-short\.md`\].*smallest working script/s,
  );
  assert.doesNotMatch(
    readmeZh,
    /第一次上手建议直接看 \[`projs\/examples\/demo-short\.md`\]/,
  );
});

test("run.sh resolves the examples directory to the minimal onboarding script", async () => {
  const { stdout } = await execFileAsync("bash", ["run.sh", "plan", "projs/examples"], {
    cwd: path.resolve("."),
  });

  assert.match(stdout, /Script: projs\/examples\/demo-short\.min\.md/);
  assert.match(stdout, /Plan ready for Neon Run Minimal/);
});

test("deprecated Veo preview aliases map to supported model names", () => {
  assert.equal(normalizeVeoModelName("veo-3.0-generate-preview"), "veo-3.1-generate-preview");
  assert.equal(normalizeVeoModelName("veo-3.0-fast-generate-preview"), "veo-3.1-fast-generate-preview");
  assert.equal(normalizeVeoModelName("veo-3.1-generate-preview"), "veo-3.1-generate-preview");
});
