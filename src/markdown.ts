import path from "node:path";
import { promises as fs } from "node:fs";
import matter from "gray-matter";
import YAML from "yaml";

import {
  type ParsedProject,
  type ParsedScene,
  type ParsedShot,
  projectConfigSchema,
  shotMetaSchema,
} from "./types.js";
import { formatIndex } from "./utils.js";

interface ShotDraft {
  title: string;
  lines: string[];
}

interface SceneDraft {
  title: string;
  introLines: string[];
  shots: ShotDraft[];
}

function extractShotBody(input: string): { body: string; meta: unknown } {
  const match = input.match(/^\s*```ya?ml\s*\n([\s\S]*?)\n```\s*\n?/);
  if (!match) {
    return {
      body: input.trim(),
      meta: {},
    };
  }

  const parsedMeta = YAML.parse(match[1]) ?? {};
  const body = input.slice(match[0].length).trim();

  return {
    body,
    meta: parsedMeta,
  };
}

function buildSceneDrafts(content: string): SceneDraft[] {
  const lines = content.split(/\r?\n/);
  const scenes: SceneDraft[] = [];
  let currentScene: SceneDraft | undefined;
  let currentShot: ShotDraft | undefined;

  const flushShot = (): void => {
    if (!currentScene || !currentShot) {
      return;
    }

    currentScene.shots.push(currentShot);
    currentShot = undefined;
  };

  const flushScene = (): void => {
    if (!currentScene) {
      return;
    }

    flushShot();

    const isMeaningful =
      currentScene.shots.length > 0 ||
      currentScene.introLines.some((line) => line.trim().length > 0);

    if (isMeaningful) {
      scenes.push(currentScene);
    }

    currentScene = undefined;
  };

  for (const line of lines) {
    const sceneMatch = line.match(/^# (.+)$/);
    if (sceneMatch) {
      flushScene();
      currentScene = {
        title: sceneMatch[1].trim(),
        introLines: [],
        shots: [],
      };
      continue;
    }

    const shotMatch = line.match(/^## (.+)$/);
    if (shotMatch) {
      if (!currentScene) {
        currentScene = {
          title: "Scene 1",
          introLines: [],
          shots: [],
        };
      }

      flushShot();
      currentShot = {
        title: shotMatch[1].trim(),
        lines: [],
      };
      continue;
    }

    if (currentShot) {
      currentShot.lines.push(line);
      continue;
    }

    if (!currentScene) {
      currentScene = {
        title: "Scene 1",
        introLines: [],
        shots: [],
      };
    }

    currentScene.introLines.push(line);
  }

  flushScene();
  return scenes;
}

export async function parseMarkdownScript(scriptPath: string): Promise<ParsedProject> {
  const absoluteScriptPath = path.resolve(scriptPath);
  const raw = await fs.readFile(absoluteScriptPath, "utf8");
  const parsed = matter(raw);
  const project = projectConfigSchema.parse(parsed.data);
  const sceneDrafts = buildSceneDrafts(parsed.content);

  if (sceneDrafts.length === 0) {
    throw new Error("No scenes found in markdown script.");
  }

  const knownCharacters = new Set(project.characters.map((character) => character.id));
  const scenes: ParsedScene[] = [];
  let globalShotIndex = 0;

  for (const [sceneIndex, sceneDraft] of sceneDrafts.entries()) {
    if (sceneDraft.shots.length === 0) {
      continue;
    }

    const sceneId = `scene-${formatIndex(sceneIndex + 1)}`;
    const synopsis = sceneDraft.introLines.join("\n").trim() || undefined;
    const shots: ParsedShot[] = [];

    for (const [shotIndex, shotDraft] of sceneDraft.shots.entries()) {
      globalShotIndex += 1;
      const { body, meta } = extractShotBody(shotDraft.lines.join("\n"));
      const shotMeta = shotMetaSchema.parse(meta);

      for (const characterId of shotMeta.characters) {
        if (!knownCharacters.has(characterId)) {
          throw new Error(
            `Unknown character "${characterId}" referenced in ${sceneId} / ${shotDraft.title}.`,
          );
        }
      }

      shots.push({
        id: `${sceneId}-shot-${formatIndex(shotIndex + 1)}`,
        sceneId,
        sceneIndex: sceneIndex + 1,
        shotIndex: shotIndex + 1,
        globalIndex: globalShotIndex,
        title: shotDraft.title,
        body,
        durationSec: shotMeta.durationSec ?? project.defaultClipDurationSec,
        meta: shotMeta,
      });
    }

    scenes.push({
      id: sceneId,
      index: sceneIndex + 1,
      title: sceneDraft.title,
      synopsis,
      shots,
    });
  }

  if (scenes.length === 0) {
    throw new Error("Markdown script does not contain any shots. Add `## Shot Title` sections.");
  }

  const totalDurationSec = scenes.reduce((sceneTotal, scene) => {
    return (
      sceneTotal +
      scene.shots.reduce((shotTotal, shot) => shotTotal + shot.durationSec, 0)
    );
  }, 0);

  return {
    scriptPath: absoluteScriptPath,
    project,
    scenes,
    totalDurationSec,
  };
}
