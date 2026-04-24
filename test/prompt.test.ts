import test from "node:test";
import assert from "node:assert/strict";

import { buildShotPrompt } from "../src/prompt.js";
import type { ParsedScene, ParsedShot, ProjectConfig } from "../src/types.js";

test("shot prompt separates spoken dialogue from visual script text", () => {
  const project: ProjectConfig = {
    title: "Dialogue Guard",
    model: "veo-3.1-generate-preview",
    aspectRatio: "16:9",
    resolution: "720p",
    maxDurationSec: 16,
    defaultClipDurationSec: 8,
    generateAudio: true,
    enhancePrompt: true,
    personGeneration: "allow_adult",
    characters: [
      {
        id: "meilin",
        name: "Mei Lin",
        description: "student",
        referenceImages: [],
      },
    ],
    styleReferenceImages: [],
    outputDir: "outputs",
  };
  const scene: ParsedScene = {
    id: "scene-01",
    index: 1,
    title: "Scene",
    synopsis: "",
    shots: [],
  };
  const shot: ParsedShot = {
    id: "scene-01-shot-01",
    sceneId: "scene-01",
    sceneIndex: 1,
    shotIndex: 1,
    globalIndex: 1,
    title: "Line",
    durationSec: 8,
    body: "Mei Lin looks toward the window.\n\nMei Lin: This is our last chance.\n\nDirector intent:\n- objective: Keep the moment quiet.",
    meta: {
      characters: ["meilin"],
      references: [],
      continueFromPrevious: false,
      seedOffset: 0,
    },
  };

  const prompt = buildShotPrompt({ project, scene, shot });

  assert.match(prompt, /Shot script:\nMei Lin looks toward the window\./);
  assert.doesNotMatch(prompt, /Shot script:[\s\S]*Mei Lin:/);
  assert.match(prompt, /Director intent:\n- objective: Keep the moment quiet\./);
  assert.doesNotMatch(prompt, /Spoken dialogue[\s\S]*Keep the moment quiet/);
  assert.match(prompt, /Spoken dialogue for audio and lip movement only:/);
  assert.match(prompt, /- This is our last chance\./);
  assert.match(prompt, /Do not render these words, speaker names, subtitles/);
});

test("shot prompt names attached reference image character bindings", () => {
  const project: ProjectConfig = {
    title: "Reference Mapping",
    model: "veo-3.1-generate-preview",
    aspectRatio: "16:9",
    resolution: "720p",
    maxDurationSec: 16,
    defaultClipDurationSec: 8,
    generateAudio: true,
    enhancePrompt: true,
    personGeneration: "allow_adult",
    characters: [
      {
        id: "lian",
        name: "Li An",
        description: "student",
        referenceImages: [],
      },
      {
        id: "meilin",
        name: "Mei Lin",
        description: "student",
        referenceImages: [],
      },
    ],
    styleReferenceImages: [],
    outputDir: "outputs",
  };
  const scene: ParsedScene = {
    id: "scene-01",
    index: 1,
    title: "Scene",
    synopsis: "",
    shots: [],
  };
  const shot: ParsedShot = {
    id: "scene-01-shot-01",
    sceneId: "scene-01",
    sceneIndex: 1,
    shotIndex: 1,
    globalIndex: 1,
    title: "Two Shot",
    durationSec: 8,
    body: "Li An and Mei Lin sit by the window.",
    meta: {
      characters: ["lian", "meilin"],
      references: [],
      continueFromPrevious: false,
      seedOffset: 0,
    },
  };

  const prompt = buildShotPrompt({
    project,
    scene,
    shot,
    hasReferenceImages: true,
    selectedReferences: [
      {
        sourceLabel: "character:lian",
        sourcePath: "refs/lian.png",
        referenceType: "ASSET",
      },
      {
        sourceLabel: "character:meilin",
        sourcePath: "refs/meilin.png",
        referenceType: "ASSET",
      },
    ],
  });

  assert.match(prompt, /image 1: character:lian; type=ASSET; path=refs\/lian\.png/);
  assert.match(prompt, /image 2: character:meilin; type=ASSET; path=refs\/meilin\.png/);
  assert.match(prompt, /do not swap a blazer for a vest/);
});
