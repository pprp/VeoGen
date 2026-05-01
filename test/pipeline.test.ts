import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import { parseMarkdownScript } from "../src/markdown.js";
import { runCreativePipeline } from "../src/pipeline.js";
import type { GeminiCreativeLikeClient } from "../src/gemini-creative.js";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeTinyPng(filePath: string): Promise<void> {
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s8l9W8AAAAASUVORK5CYII=",
    "base64",
  );
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, onePixelPng);
}

test("creative pipeline stops after the final script by default and emits Chinese fallback script text", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-");
  const result = await runCreativePipeline({
    idea: "A burnt-out night courier must cross a flooded neon city with a memory drive before sunrise.",
    outputDir,
    dryRun: true,
    skipCharacterImages: true,
  });

  assert.equal(result.sourceMode, "idea");
  assert.equal(result.runDir, outputDir);
  assert.equal(result.renderRequested, false);
  assert.equal(result.renderManifestPath, undefined);

  const finalScript = await fs.readFile(result.finalScriptPath, "utf8");
  assert.match(finalScript, /# 开场/);
  assert.match(finalScript, /## 世界建立/);
  assert.match(finalScript, /导演意图：/);
  assert.match(finalScript, /林夏/);
  assert.match(finalScript, /Do not alternate between photoreal/);
  assert.match(finalScript, /stylized 3D\s+looks/);
  assert.match(finalScript, /burned-in dialogue\s+words/);

  const parsedProject = await parseMarkdownScript(result.finalScriptPath);
  assert.ok(parsedProject.project.characters.length >= 1);
  assert.ok(parsedProject.scenes.length >= 1);
  await assert.rejects(fs.access(path.join(outputDir, "render", "manifest.json")));

  const agentArtifacts = result.agentRuns.map((agentRun) => path.basename(agentRun.artifactPath));
  assert.deepEqual(agentArtifacts, [
    "01-script-writer.json",
    "02-script-review.json",
    "03-character-pack.json",
    "04-character-evaluation.json",
    "05-director-report.json",
  ]);
});

test("creative pipeline only creates render artifacts when render is explicitly requested", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-render-");
  const result = await runCreativePipeline({
    idea: "A burnt-out night courier must cross a flooded neon city with a memory drive before sunrise.",
    outputDir,
    dryRun: true,
    render: true,
    skipCharacterImages: true,
  });

  assert.equal(result.renderRequested, true);
  assert.ok(result.renderManifestPath);

  const manifestRaw = await fs.readFile(result.renderManifestPath!, "utf8");
  const manifest = JSON.parse(manifestRaw) as {
    shots: Array<{ status: string }>;
  };
  assert.ok(manifest.shots.length >= 1);
  assert.ok(manifest.shots.every((shot) => shot.status === "pending"));
  const firstPrompt = await fs.readFile(
    path.join(outputDir, "render", "prompts", "01-scene-01-shot-01.txt"),
    "utf8",
  );
  assert.match(firstPrompt, /never render subtitles, captions, transcript text/);

  const agentArtifacts = result.agentRuns.map((agentRun) => path.basename(agentRun.artifactPath));
  assert.deepEqual(agentArtifacts, [
    "01-script-writer.json",
    "02-script-review.json",
    "03-character-pack.json",
    "04-character-evaluation.json",
    "05-director-report.json",
  ]);
});

test("creative pipeline regenerates character images when evaluation score is below threshold", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-revision-");
  const generatedImagePrompts: string[] = [];
  let evaluationRound = 0;
  let structuredRound = 0;

  const mockClient: GeminiCreativeLikeClient = {
    async generateStructuredOutput() {
      structuredRound += 1;
      if (structuredRound === 1) {
        return {
          title: "Revision Loop",
          synopsis: "A lead character gets visually refined until the art direction locks in.",
          style: "stylized cinematic sci-fi with clean shape language",
          aspectRatio: "16:9",
          resolution: "720p",
          defaultClipDurationSec: 8,
          maxDurationSec: 24,
          personGeneration: "allow_adult",
          negativePrompt: "flicker, subtitles, warped anatomy",
          characters: [
            {
              id: "hero",
              name: "Hero",
              role: "protagonist",
              description: "a determined courier",
              look: "angular silhouette, short silver hair, alert eyes",
              wardrobe: "weatherproof midnight coat with reflective trim",
              voice: "steady but strained",
              mannerisms: "scans exits before speaking",
              personalityHook: "acts controlled even when frightened",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "Introduce the lead in motion.",
              shots: [
                {
                  title: "Shot 1",
                  summary: "The lead steps into a neon alley and commits to the run.",
                  characters: ["hero"],
                  durationSec: 8,
                  location: "neon alley",
                  timeOfDay: "night",
                  camera: "medium wide",
                  movement: "slow push in",
                  mood: "tense",
                  sound: "rain and distant traffic",
                  transition: "",
                  continueFromPrevious: false,
                  dialogue: [],
                },
              ],
            },
          ],
        };
      }

      if (structuredRound === 2) {
        return {
          verdict: "approved",
          strengths: ["Clear premise"],
          risks: [],
          requiredChanges: [],
          continuityNotes: ["Keep the lead silhouette stable."],
        };
      }

      if (structuredRound === 3) {
        return {
          globalDirection: ["Keep the subject centered in the strongest frame."],
          stitchingPlan: ["Cut on forward motion."],
          finalLookNotes: ["Maintain sharp silhouette contrast."],
          shotObjectives: [
            {
              sceneTitle: "Scene 1",
              shotTitle: "Shot 1",
              objective: "Introduce the protagonist with confidence.",
              visualDirective: "Favor silhouette readability.",
              editHint: "Cut on motion.",
            },
          ],
        };
      }

      throw new Error(`Unexpected structured output call ${structuredRound}`);
    },
    async analyzeImages() {
      evaluationRound += 1;
      if (evaluationRound === 1) {
        return {
          styleConsistencyScore: 72,
          overallNotes: ["The style family is close but still too generic."],
          recommendedGlobalAdjustments: ["Push stronger graphic shape language and color discipline."],
          characters: [
            {
              id: "hero",
              needsRevision: true,
              styleAlignmentScore: 55,
              consistency: "Low. The style deviates and clashes with the rest of the cast.",
              distinctiveness: "Readable, but achieved through stylistic exaggeration.",
              refinementAdvice: ["Sharpen the silhouette and make the silver hair streak more iconic."],
            },
          ],
        };
      }

      return {
        styleConsistencyScore: 91,
        overallNotes: ["The character now reads as part of a cohesive film world."],
        recommendedGlobalAdjustments: ["Preserve the current design language."],
        characters: [
          {
            id: "hero",
            needsRevision: false,
            styleAlignmentScore: 91,
            consistency: "Consistent with the target visual style.",
            distinctiveness: "The silhouette and hair streak now read clearly.",
            refinementAdvice: ["Keep the current proportions stable in later renders."],
          },
        ],
      };
    },
    async generateImage(request) {
      generatedImagePrompts.push(request.prompt);
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
  };

  const result = await runCreativePipeline({
    idea: "A courier refines their visual identity before the film begins.",
    outputDir,
    skipRender: true,
    geminiCreativeClient: mockClient,
    characterConsistencyThreshold: 85,
    maxCharacterRefinementRounds: 1,
  });

  assert.equal(result.characterRefinementRoundsApplied, 1);
  assert.equal(result.finalCharacterConsistencyScore, 91);
  assert.ok(generatedImagePrompts.length >= 1);
  assert.ok(generatedImagePrompts.some((prompt) => /Revision round: 1\./.test(prompt)));
  assert.deepEqual(
    result.agentRuns.map((agentRun) => agentRun.name),
    [
      "script-writer",
      "script-review",
      "character-creation",
      "character-evaluation",
      "character-creation-revision-1",
      "character-evaluation-revision-1",
      "director",
    ],
  );

  const finalScript = await fs.readFile(result.finalScriptPath, "utf8");
  assert.match(finalScript, /hero-rev-1\.png/);
});

test("creative pipeline only regenerates characters flagged as inconsistent", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-selective-revision-");
  const generatedImageOutputs: string[] = [];
  let structuredRound = 0;
  let evaluationRound = 0;

  const mockClient: GeminiCreativeLikeClient = {
    async generateStructuredOutput() {
      structuredRound += 1;
      if (structuredRound === 1) {
        return {
          title: "Selective Revision",
          synopsis: "Only one character should be regenerated.",
          style: "warm nostalgic realism",
          aspectRatio: "16:9",
          resolution: "720p",
          defaultClipDurationSec: 8,
          maxDurationSec: 24,
          personGeneration: "allow_adult",
          negativePrompt: "flicker",
          characters: [
            {
              id: "hero",
              name: "Hero",
              role: "protagonist",
              description: "lead",
              look: "short black hair",
              wardrobe: "uniform",
              voice: "quiet",
              mannerisms: "still",
              personalityHook: "observant",
            },
            {
              id: "friend",
              name: "Friend",
              role: "friend",
              description: "friend",
              look: "ponytail",
              wardrobe: "uniform",
              voice: "bright",
              mannerisms: "animated",
              personalityHook: "supportive",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "scene",
              shots: [
                {
                  title: "Shot 1",
                  summary: "beat",
                  characters: ["hero", "friend"],
                  durationSec: 8,
                  location: "classroom",
                  timeOfDay: "day",
                  camera: "medium",
                  movement: "slow",
                  mood: "warm",
                  sound: "fan",
                  transition: "",
                  continueFromPrevious: false,
                  dialogue: [],
                },
              ],
            },
          ],
        };
      }

      if (structuredRound === 2) {
        return {
          verdict: "approved",
          strengths: [],
          risks: [],
          requiredChanges: [],
          continuityNotes: [],
        };
      }

      return {
        globalDirection: [],
        stitchingPlan: [],
        finalLookNotes: [],
        shotObjectives: [],
      };
    },
    async analyzeImages() {
      evaluationRound += 1;
      if (evaluationRound === 1) {
        return {
          styleConsistencyScore: 70,
          overallNotes: [],
          recommendedGlobalAdjustments: ["Match the friend's realism level."],
          characters: [
            {
              id: "hero",
              needsRevision: true,
              styleAlignmentScore: 55,
              consistency: "Low. The style deviates and clashes with the rest of the cast.",
              distinctiveness: "Readable, but achieved through stylistic exaggeration.",
              refinementAdvice: ["Pull hero back into the shared visual family."],
            },
            {
              id: "friend",
              needsRevision: false,
              styleAlignmentScore: 88,
              consistency: "High. Matches the intended visual world.",
              distinctiveness: "Clear and stable.",
              refinementAdvice: [],
            },
          ],
        };
      }

      return {
        styleConsistencyScore: 90,
        overallNotes: [],
        recommendedGlobalAdjustments: [],
        characters: [
          {
            id: "hero",
            needsRevision: false,
            styleAlignmentScore: 90,
            consistency: "High. Matches the intended visual world.",
            distinctiveness: "Clear and stable.",
            refinementAdvice: [],
          },
          {
            id: "friend",
            needsRevision: false,
            styleAlignmentScore: 90,
            consistency: "High. Matches the intended visual world.",
            distinctiveness: "Clear and stable.",
            refinementAdvice: [],
          },
        ],
      };
    },
    async generateImage(request) {
      generatedImageOutputs.push(path.basename(request.outputPath));
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
  };

  const result = await runCreativePipeline({
    idea: "selective regeneration",
    outputDir,
    skipRender: true,
    geminiCreativeClient: mockClient,
    characterConsistencyThreshold: 85,
    maxCharacterRefinementRounds: 1,
  });

  assert.deepEqual(generatedImageOutputs, ["cast-lineup.png", "hero.png", "friend.png", "hero-rev-1.png"]);
  const characterPack = JSON.parse(
    await fs.readFile(path.join(result.developmentDir, "03-character-pack.json"), "utf8"),
  ) as {
    lineupImagePath?: string;
    characters: Array<{ id: string; imagePrompt: string; lineupPosition?: number; lineupSize?: number }>;
  };
  assert.match(path.basename(characterPack.lineupImagePath ?? ""), /cast-lineup\.png/);
  assert.deepEqual(
    characterPack.characters.map((character) => ({
      id: character.id,
      lineupPosition: character.lineupPosition,
      lineupSize: character.lineupSize,
    })),
    [
      { id: "hero", lineupPosition: 1, lineupSize: 2 },
      { id: "friend", lineupPosition: 2, lineupSize: 2 },
    ],
  );
  assert.match(characterPack.characters[0].imagePrompt, /target is character 1 of 2 counting from left to right/);
  assert.match(characterPack.characters[1].imagePrompt, /target is character 2 of 2 counting from left to right/);
  const finalScript = await fs.readFile(result.finalScriptPath, "utf8");
  assert.match(finalScript, /hero-rev-1\.png/);
  assert.match(finalScript, /friend\.png/);
  assert.doesNotMatch(finalScript, /friend-rev-1\.png/);
});

test("creative pipeline normalizes incomplete character evaluation fields before revision", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-normalized-eval-");
  const generatedImageOutputs: string[] = [];
  let structuredRound = 0;
  let evaluationRound = 0;

  const mockClient: GeminiCreativeLikeClient = {
    async generateStructuredOutput() {
      structuredRound += 1;
      if (structuredRound === 1) {
        return {
          title: "Incomplete Evaluation",
          synopsis: "A character evaluator omits required fields.",
          style: "grounded nostalgic school illustration",
          aspectRatio: "16:9",
          resolution: "720p",
          defaultClipDurationSec: 8,
          maxDurationSec: 24,
          personGeneration: "allow_adult",
          negativePrompt: "flicker",
          characters: [
            {
              id: "anchor",
              name: "Anchor",
              role: "protagonist",
              description: "visual anchor",
              look: "short black hair",
              wardrobe: "blue and white school uniform",
              voice: "quiet",
              mannerisms: "still",
              personalityHook: "observant",
            },
            {
              id: "drifter",
              name: "Drifter",
              role: "friend",
              description: "style drifting friend",
              look: "ponytail",
              wardrobe: "blue and white school uniform",
              voice: "bright",
              mannerisms: "animated",
              personalityHook: "supportive",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "scene",
              shots: [
                {
                  title: "Shot 1",
                  summary: "beat",
                  characters: ["anchor", "drifter"],
                  durationSec: 8,
                  location: "classroom",
                  timeOfDay: "day",
                  camera: "medium",
                  movement: "slow",
                  mood: "warm",
                  sound: "fan",
                  transition: "",
                  continueFromPrevious: false,
                  dialogue: [],
                },
              ],
            },
          ],
        };
      }

      if (structuredRound === 2) {
        return {
          verdict: "approved",
          strengths: [],
          risks: [],
          requiredChanges: [],
          continuityNotes: [],
        };
      }

      return {
        globalDirection: [],
        stitchingPlan: [],
        finalLookNotes: [],
        shotObjectives: [],
      };
    },
    async analyzeImages() {
      evaluationRound += 1;
      if (evaluationRound === 1) {
        return {
          styleConsistencyScore: 45,
          overallNotes: ["The lineup has significant style drift."],
          recommendedGlobalAdjustments: ["Use Anchor as the visual baseline."],
          characters: [
            {
              id: "anchor",
              consistency: "Good anchor. This design is closest to the intended visual family.",
              distinctiveness: "Clear and stable.",
              refinementAdvice: [],
            },
            {
              id: "drifter",
              consistency: "Poor. Significant anime drift and inconsistent line treatment.",
              distinctiveness: "Readable but mismatched.",
              refinementAdvice: ["Pull Drifter back into Anchor's grounded visual family."],
            },
          ],
        };
      }

      return {
        styleConsistencyScore: 91,
        overallNotes: [],
        recommendedGlobalAdjustments: [],
        characters: [
          {
            id: "anchor",
            needsRevision: false,
            styleAlignmentScore: 91,
            consistency: "consistent",
            distinctiveness: "distinct",
            refinementAdvice: [],
          },
          {
            id: "drifter",
            needsRevision: false,
            styleAlignmentScore: 91,
            consistency: "consistent",
            distinctiveness: "distinct",
            refinementAdvice: [],
          },
        ],
      };
    },
    async generateImage(request) {
      generatedImageOutputs.push(path.basename(request.outputPath));
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
  };

  const result = await runCreativePipeline({
    idea: "normalized evaluation",
    outputDir,
    skipRender: true,
    geminiCreativeClient: mockClient,
    characterConsistencyThreshold: 85,
    maxCharacterRefinementRounds: 1,
  });

  assert.deepEqual(generatedImageOutputs, ["cast-lineup.png", "anchor.png", "drifter.png", "drifter-rev-1.png"]);
  const finalScript = await fs.readFile(result.finalScriptPath, "utf8");
  assert.match(finalScript, /anchor\.png/);
  assert.match(finalScript, /drifter-rev-1\.png/);
  assert.doesNotMatch(finalScript, /anchor-rev-1\.png/);
});

test("creative pipeline uses a clean text prompt when lineup-derived image editing falls back", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-lineup-fallback-");
  const fallbackPrompts: string[] = [];
  let structuredRound = 0;

  const mockClient: GeminiCreativeLikeClient = {
    async generateStructuredOutput() {
      structuredRound += 1;
      if (structuredRound === 1) {
        return {
          title: "Lineup Fallback",
          synopsis: "Image editing fails after the lineup is created.",
          style: "grounded warm illustration",
          aspectRatio: "16:9",
          resolution: "720p",
          defaultClipDurationSec: 8,
          maxDurationSec: 24,
          personGeneration: "allow_adult",
          negativePrompt: "flicker",
          characters: [
            {
              id: "hero",
              name: "Hero",
              role: "lead",
              description: "lead",
              look: "short black hair",
              wardrobe: "uniform",
              voice: "quiet",
              mannerisms: "still",
              personalityHook: "observant",
            },
            {
              id: "friend",
              name: "Friend",
              role: "friend",
              description: "friend",
              look: "ponytail",
              wardrobe: "uniform",
              voice: "bright",
              mannerisms: "animated",
              personalityHook: "supportive",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "scene",
              shots: [
                {
                  title: "Shot 1",
                  summary: "beat",
                  characters: ["hero", "friend"],
                  durationSec: 8,
                  location: "classroom",
                  timeOfDay: "day",
                  camera: "medium",
                  movement: "slow",
                  mood: "warm",
                  sound: "fan",
                  transition: "",
                  continueFromPrevious: false,
                  dialogue: [],
                },
              ],
            },
          ],
        };
      }

      if (structuredRound === 2) {
        return {
          verdict: "approved",
          strengths: [],
          risks: [],
          requiredChanges: [],
          continuityNotes: [],
        };
      }

      return {
        globalDirection: [],
        stitchingPlan: [],
        finalLookNotes: [],
        shotObjectives: [],
      };
    },
    async analyzeImages() {
      return {
        styleConsistencyScore: 95,
        overallNotes: [],
        recommendedGlobalAdjustments: [],
        characters: [
          {
            id: "hero",
            needsRevision: false,
            styleAlignmentScore: 95,
            consistency: "consistent",
            distinctiveness: "distinct",
            refinementAdvice: [],
          },
          {
            id: "friend",
            needsRevision: false,
            styleAlignmentScore: 95,
            consistency: "consistent",
            distinctiveness: "distinct",
            refinementAdvice: [],
          },
        ],
      };
    },
    async generateImage(request) {
      if (path.basename(request.outputPath) !== "cast-lineup.png") {
        fallbackPrompts.push(request.prompt);
      }
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
    async editImage() {
      throw new Error("image editing unavailable");
    },
  };

  const result = await runCreativePipeline({
    idea: "lineup fallback",
    outputDir,
    skipRender: true,
    geminiCreativeClient: mockClient,
  });

  assert.equal(fallbackPrompts.length, 2);
  assert.ok(fallbackPrompts.every((prompt) => !/attached cast lineup/i.test(prompt)));
  assert.ok(fallbackPrompts.every((prompt) => !/target is character/i.test(prompt)));
  assert.ok(result.warnings.some((warning) => /could not derive hero from the cast lineup/.test(warning)));
  assert.ok(result.warnings.some((warning) => /could not derive friend from the cast lineup/.test(warning)));
});

test("creative pipeline evaluates against the cast lineup and uses it for revision edits", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-style-master-");
  const editedTargets: Array<{ base: string; style: string; output: string }> = [];
  const analyzedImageOrders: string[][] = [];
  let structuredRound = 0;
  let evaluationRound = 0;

  const mockClient: GeminiCreativeLikeClient = {
    async generateStructuredOutput() {
      structuredRound += 1;
      if (structuredRound === 1) {
        return {
          title: "Style Master",
          synopsis: "Use the best character as the style master.",
          style: "warm nostalgic realism",
          aspectRatio: "16:9",
          resolution: "720p",
          defaultClipDurationSec: 8,
          maxDurationSec: 24,
          personGeneration: "allow_adult",
          negativePrompt: "flicker",
          characters: [
            {
              id: "hero",
              name: "Hero",
              role: "protagonist",
              description: "lead",
              look: "short black hair",
              wardrobe: "uniform",
              voice: "quiet",
              mannerisms: "still",
              personalityHook: "observant",
            },
            {
              id: "master",
              name: "Master",
              role: "friend",
              description: "friend",
              look: "ponytail",
              wardrobe: "uniform",
              voice: "bright",
              mannerisms: "animated",
              personalityHook: "supportive",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "scene",
              shots: [
                {
                  title: "Shot 1",
                  summary: "beat",
                  characters: ["hero", "master"],
                  durationSec: 8,
                  location: "classroom",
                  timeOfDay: "day",
                  camera: "medium",
                  movement: "slow",
                  mood: "warm",
                  sound: "fan",
                  transition: "",
                  continueFromPrevious: false,
                  dialogue: [],
                },
              ],
            },
          ],
        };
      }

      if (structuredRound === 2) {
        return {
          verdict: "approved",
          strengths: [],
          risks: [],
          requiredChanges: [],
          continuityNotes: [],
        };
      }

      return {
        globalDirection: [],
        stitchingPlan: [],
        finalLookNotes: [],
        shotObjectives: [],
      };
    },
    async analyzeImages(request) {
      analyzedImageOrders.push(request.imagePaths.map((imagePath) => path.basename(imagePath)));
      evaluationRound += 1;
      if (evaluationRound === 1) {
        return {
          styleConsistencyScore: 72,
          overallNotes: [],
          recommendedGlobalAdjustments: ["Match the master's realism level."],
          characters: [
            {
              id: "hero",
              needsRevision: true,
              styleAlignmentScore: 50,
              consistency: "Poor. Significant style drift from the rest of the cast.",
              distinctiveness: "Readable but too stylized.",
              refinementAdvice: ["Bring hero into the master's visual family."],
            },
            {
              id: "master",
              needsRevision: false,
              styleAlignmentScore: 92,
              consistency: "High. Strong match for the intended visual world.",
              distinctiveness: "Clear and stable.",
              refinementAdvice: [],
            },
          ],
        };
      }

      return {
        styleConsistencyScore: 90,
        overallNotes: [],
        recommendedGlobalAdjustments: [],
        characters: [
          {
            id: "hero",
            needsRevision: false,
            styleAlignmentScore: 90,
            consistency: "High. Matches the intended visual world.",
            distinctiveness: "Clear and stable.",
            refinementAdvice: [],
          },
          {
            id: "master",
            needsRevision: false,
            styleAlignmentScore: 92,
            consistency: "High. Strong match for the intended visual world.",
            distinctiveness: "Clear and stable.",
            refinementAdvice: [],
          },
        ],
      };
    },
    async generateImage(request) {
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
    async editImage(request) {
      editedTargets.push({
        base: path.basename(request.baseImagePath),
        style: path.basename(request.styleImagePath),
        output: path.basename(request.outputPath),
      });
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
  };

  await runCreativePipeline({
    idea: "style master test",
    outputDir,
    skipRender: true,
    geminiCreativeClient: mockClient,
    characterConsistencyThreshold: 85,
    maxCharacterRefinementRounds: 1,
  });

  assert.deepEqual(editedTargets, [
    {
      base: "cast-lineup.png",
      style: "cast-lineup.png",
      output: "hero.png",
    },
    {
      base: "cast-lineup.png",
      style: "cast-lineup.png",
      output: "master.png",
    },
    {
      base: "hero.png",
      style: "cast-lineup.png",
      output: "hero-rev-1.png",
    },
  ]);
  assert.deepEqual(analyzedImageOrders, [
    ["cast-lineup.png", "hero.png", "master.png"],
    ["cast-lineup.png", "hero-rev-1.png", "master.png"],
  ]);
});

test("creative pipeline applies script revisions before downstream agents run", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-script-revision-");
  let structuredRound = 0;

  const mockClient: GeminiCreativeLikeClient = {
    async generateStructuredOutput() {
      structuredRound += 1;
      if (structuredRound === 1) {
        return {
          title: "Revision Demo",
          synopsis: "A rough first draft that still needs cleanup.",
          style: "clean neon thriller",
          aspectRatio: "16:9",
          resolution: "720p",
          defaultClipDurationSec: 8,
          maxDurationSec: 24,
          personGeneration: "allow_adult",
          negativePrompt: "flicker, subtitles",
          characters: [
            {
              id: "lead",
              name: "Lead",
              role: "protagonist",
              description: "an exhausted courier",
              look: "thin silhouette, sharp eyes",
              wardrobe: "dark technical jacket",
              voice: "low and tired",
              mannerisms: "checks exits constantly",
              personalityHook: "keeps moving no matter the cost",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "The courier enters the alley.",
              shots: [
                {
                  title: "Shot 1",
                  summary: "The courier walks into the alley.",
                  characters: ["lead"],
                  durationSec: 8,
                  location: "alley",
                  timeOfDay: "night",
                  camera: "wide shot",
                  movement: "slow push",
                  mood: "plain",
                  sound: "distant traffic",
                  transition: "",
                  continueFromPrevious: false,
                  dialogue: [],
                },
              ],
            },
          ],
        };
      }

      if (structuredRound === 2) {
        return {
          verdict: "revise_lightly",
          strengths: ["Clear core premise"],
          risks: ["The opening shot is too generic."],
          requiredChanges: ["Make the first shot more specific and cinematic."],
          continuityNotes: ["Preserve the lead's nervous scanning behavior."],
        };
      }

      if (structuredRound === 3) {
        return {
          title: "Revision Demo",
          synopsis: "A tightened revision that clarifies the opening image.",
          style: "clean neon thriller",
          aspectRatio: "16:9",
          resolution: "720p",
          defaultClipDurationSec: 8,
          maxDurationSec: 24,
          personGeneration: "allow_adult",
          negativePrompt: "flicker, subtitles",
          characters: [
            {
              id: "lead",
              name: "Lead",
              role: "protagonist",
              description: "an exhausted courier",
              look: "thin silhouette, sharp eyes",
              wardrobe: "dark technical jacket",
              voice: "low and tired",
              mannerisms: "checks exits constantly",
              personalityHook: "keeps moving no matter the cost",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "The courier enters the alley.",
              shots: [
                {
                  title: "Shot 1",
                  summary: "Rainwater flashes neon reflections as the courier slips under a sparking sign and scans every fire escape before moving.",
                  characters: ["lead"],
                  durationSec: 8,
                  location: "flooded neon alley",
                  timeOfDay: "night",
                  camera: "low-angle medium wide",
                  movement: "cautious glide forward",
                  mood: "tense and specific",
                  sound: "electrical buzz, rain, quick breath",
                  transition: "",
                  continueFromPrevious: false,
                  dialogue: [],
                },
              ],
            },
          ],
        };
      }

      if (structuredRound === 4) {
        return {
          globalDirection: ["Hold on the revised entrance image."],
          stitchingPlan: ["Cut only after the lead scans upward."],
          finalLookNotes: ["Keep the neon reflections vivid."],
          shotObjectives: [
            {
              sceneTitle: "Scene 1",
              shotTitle: "Shot 1",
              objective: "Make the opening image memorable immediately.",
              visualDirective: "Emphasize the sparking sign and flood reflections.",
              editHint: "Stay in the moment a beat longer before cutting.",
            },
          ],
        };
      }

      throw new Error(`Unexpected structured output call ${structuredRound}`);
    },
    async analyzeImages() {
      return {
        styleConsistencyScore: 90,
        overallNotes: ["Good enough for production."],
        recommendedGlobalAdjustments: [],
        characters: [
          {
            id: "lead",
            needsRevision: false,
            styleAlignmentScore: 90,
            consistency: "Consistent",
            distinctiveness: "Distinct",
            refinementAdvice: [],
          },
        ],
      };
    },
    async generateImage(request) {
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
  };

  const result = await runCreativePipeline({
    idea: "A courier enters a dangerous neon alley.",
    outputDir,
    skipRender: true,
    geminiCreativeClient: mockClient,
  });

  const finalScript = await fs.readFile(result.finalScriptPath, "utf8");
  assert.match(finalScript, /sparking sign and scans every fire escape/);
  assert.match(finalScript, /transcript text/);
  assert.match(finalScript, /lower-third text/);
  assert.doesNotMatch(finalScript, /The courier walks into the alley\./);
  assert.ok(result.agentRuns.some((agentRun) => agentRun.name === "script-revision"));
});

test("creative pipeline raises maxDurationSec to cover planner-forced 8s clips", async () => {
  const outputDir = await makeTempDir("veogen-pipeline-duration-");
  let structuredRound = 0;

  const mockClient: GeminiCreativeLikeClient = {
    async generateStructuredOutput() {
      structuredRound += 1;
      if (structuredRound === 1) {
        return {
          title: "Duration Guard",
          synopsis: "A short film with several referenced shots at 1080p.",
          style: "warm realistic memory film",
          aspectRatio: "16:9",
          resolution: "1080p",
          defaultClipDurationSec: 5,
          maxDurationSec: 90,
          personGeneration: "allow_adult",
          negativePrompt: "flicker",
          characters: [
            {
              id: "lead",
              name: "Lead",
              role: "protagonist",
              description: "student lead",
              look: "short black hair",
              wardrobe: "blue and white school uniform",
              voice: "quiet",
              mannerisms: "thoughtful glances",
              personalityHook: "nostalgic observer",
            },
          ],
          scenes: [
            {
              title: "Scene 1",
              synopsis: "Morning classroom.",
              shots: Array.from({ length: 14 }, (_, index) => ({
                title: `Shot ${index + 1}`,
                summary: `Beat ${index + 1}`,
                characters: ["lead"],
                durationSec: 5,
                location: "classroom",
                timeOfDay: "morning",
                camera: "medium",
                movement: "slow",
                mood: "warm",
                sound: "fan",
                transition: "",
                continueFromPrevious: false,
                dialogue: [],
              })),
            },
          ],
        };
      }

      if (structuredRound === 2) {
        return {
          verdict: "approved",
          strengths: [],
          risks: [],
          requiredChanges: [],
          continuityNotes: [],
        };
      }

      return {
        globalDirection: [],
        stitchingPlan: [],
        finalLookNotes: [],
        shotObjectives: [],
      };
    },
    async analyzeImages() {
      return {
        styleConsistencyScore: 95,
        overallNotes: [],
        recommendedGlobalAdjustments: [],
        characters: [
          {
            id: "lead",
            needsRevision: false,
            styleAlignmentScore: 95,
            consistency: "consistent",
            distinctiveness: "distinct",
            refinementAdvice: [],
          },
        ],
      };
    },
    async generateImage(request) {
      await writeTinyPng(request.outputPath);
      return request.outputPath;
    },
  };

  const result = await runCreativePipeline({
    idea: "duration guard idea",
    outputDir,
    skipRender: true,
    geminiCreativeClient: mockClient,
  });

  const finalScript = await fs.readFile(result.finalScriptPath, "utf8");
  assert.match(finalScript, /maxDurationSec: 112/);
});
