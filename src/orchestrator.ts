import path from "node:path";
import { promises as fs } from "node:fs";

import { parseMarkdownScript } from "./markdown.js";
import { buildShotPrompt } from "./prompt.js";
import { GeminiVideoClient } from "./gemini.js";
import { stitchVideos } from "./stitch.js";
import type {
  ManifestShot,
  ParsedProject,
  ParsedScene,
  ParsedShot,
  PlannedShot,
  ProjectConfig,
  RenderManifest,
  RenderPlan,
  SelectedReference,
} from "./types.js";
import {
  dedupeBy,
  ensureDir,
  estimateTokenCount,
  fileExists,
  formatIndex,
  relativeToCwd,
  resolveFromFile,
  safeSlug,
  sleep,
  timestampId,
} from "./utils.js";

export interface BuildPlanOptions {
  outputDir?: string;
  modelOverride?: string;
}

export interface RenderProjectOptions extends BuildPlanOptions {
  apiKey?: string;
  dryRun?: boolean;
  skipStitch?: boolean;
  pollMs?: number;
  interShotDelayMs?: number;
}

interface ReferenceCandidate extends SelectedReference {}
const TRANSIENT_RENDER_ERRORS = [
  "Video generation completed without a generated video payload.",
  "Video generation completed without a downloadable video URI.",
];

function resolveShotPersonGeneration(shot: PlannedShot, project: ProjectConfig): ProjectConfig["personGeneration"] {
  if (shot.selectedReferences.length > 0) {
    return project.personGeneration === "dont_allow" ? "dont_allow" : "allow_adult";
  }

  return "allow_all";
}

function chooseRunDir(project: ProjectConfig, explicitOutputDir?: string): string {
  if (explicitOutputDir) {
    return path.resolve(explicitOutputDir);
  }

  const slug = safeSlug(project.title);
  return path.resolve(project.outputDir, `${timestampId()}-${slug}`);
}

function normalizeDuration(
  shot: ParsedShot,
  project: ProjectConfig,
  hasReferenceImages: boolean,
  warnings: string[],
): number {
  if ((project.resolution === "1080p" || hasReferenceImages) && shot.durationSec !== 8) {
    warnings.push(
      `${shot.id}: forced duration to 8 seconds because Gemini video currently requires 8s clips for 1080p and reference-image generation.`,
    );
    return 8;
  }

  return shot.durationSec;
}

async function resolveReferenceCandidates(
  parsedProject: ParsedProject,
  shot: ParsedShot,
): Promise<{ warnings: string[]; assetCandidates: ReferenceCandidate[]; styleCandidates: ReferenceCandidate[] }> {
  const warnings: string[] = [];
  const assetCandidates: ReferenceCandidate[] = [];
  const styleCandidates: ReferenceCandidate[] = [];

  const pushCandidate = async (
    sourcePath: string,
    referenceType: "ASSET" | "STYLE",
    sourceLabel: string,
    target: ReferenceCandidate[],
  ): Promise<void> => {
    const absolutePath = resolveFromFile(parsedProject.scriptPath, sourcePath);
    if (!(await fileExists(absolutePath))) {
      warnings.push(`${shot.id}: missing reference image ${sourcePath}`);
      return;
    }

    target.push({
      sourcePath,
      absolutePath,
      referenceType,
      sourceLabel,
    });
  };

  for (const characterId of shot.meta.characters) {
    const character = parsedProject.project.characters.find((entry) => entry.id === characterId);
    if (!character) {
      continue;
    }

    for (const referenceImage of character.referenceImages) {
      await pushCandidate(referenceImage, "ASSET", `character:${characterId}`, assetCandidates);
    }
  }

  for (const referenceImage of shot.meta.references) {
    await pushCandidate(referenceImage, "ASSET", `shot:${shot.id}`, assetCandidates);
  }

  for (const referenceImage of parsedProject.project.styleReferenceImages) {
    await pushCandidate(referenceImage, "STYLE", "project-style", styleCandidates);
  }

  return {
    warnings,
    assetCandidates: dedupeBy(assetCandidates, (candidate) => candidate.absolutePath),
    styleCandidates: dedupeBy(styleCandidates, (candidate) => candidate.absolutePath),
  };
}

async function selectReferences(
  parsedProject: ParsedProject,
  shot: ParsedShot,
  willUseVideoExtension: boolean,
): Promise<{ selected: SelectedReference[]; dropped: SelectedReference[]; warnings: string[] }> {
  const { warnings, assetCandidates, styleCandidates } = await resolveReferenceCandidates(
    parsedProject,
    shot,
  );

  if (willUseVideoExtension) {
    const dropped = [...assetCandidates, ...styleCandidates];
    if (dropped.length > 0) {
      warnings.push(
        `${shot.id}: dropped ${dropped.length} reference image(s) because Gemini video extension requests cannot include referenceImages and input video at the same time.`,
      );
    }

    return {
      selected: [],
      dropped,
      warnings,
    };
  }

  const styleSelection = styleCandidates.slice(0, 1);
  const assetBudget = styleSelection.length > 0 ? 2 : 3;
  const selectedAssets = assetCandidates.slice(0, assetBudget);
  const selected = [...selectedAssets, ...styleSelection];
  const dropped = [
    ...assetCandidates.slice(selectedAssets.length),
    ...styleCandidates.slice(styleSelection.length),
  ];

  if (dropped.length > 0) {
    warnings.push(
      `${shot.id}: only the first ${selected.length} reference image(s) were selected because Gemini video supports at most 3 reference images per request.`,
    );
  }

  return {
    selected,
    dropped,
    warnings,
  };
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function materializePlan(plan: RenderPlan): Promise<void> {
  await ensureDir(plan.runDir);
  await ensureDir(path.join(plan.runDir, "clips"));
  await ensureDir(path.join(plan.runDir, "prompts"));

  for (const shot of plan.shots) {
    await fs.writeFile(shot.promptPath, `${shot.prompt}\n`, "utf8");
  }

  await writeJson(path.join(plan.runDir, "plan.json"), plan);
}

function initializeManifest(plan: RenderPlan): RenderManifest {
  return {
    ...plan,
    shots: plan.shots.map((shot): ManifestShot => {
      return {
        ...shot,
        status: "pending",
      };
    }),
  };
}

async function persistManifest(manifest: RenderManifest): Promise<void> {
  await writeJson(path.join(manifest.runDir, "manifest.json"), manifest);
}

function collectClipPaths(manifest: RenderManifest): string[] {
  return manifest.shots
    .filter((shot) => shot.status === "completed")
    .map((shot) => shot.outputPath);
}

function isTransientRenderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_RENDER_ERRORS.some((fragment) => message.includes(fragment));
}

export async function buildRenderPlan(options: BuildPlanOptions & { scriptPath: string }): Promise<RenderPlan> {
  const parsedProject = await parseMarkdownScript(options.scriptPath);
  const project =
    options.modelOverride !== undefined
      ? {
          ...parsedProject.project,
          model: options.modelOverride,
        }
      : parsedProject.project;

  const runDir = chooseRunDir(project, options.outputDir);
  const planWarnings: string[] = [];
  const shots: PlannedShot[] = [];
  let totalDurationSec = 0;
  let previousParsedShot: ParsedShot | undefined;

  for (const scene of parsedProject.scenes) {
    for (const shot of scene.shots) {
      const willUseVideoExtension = shot.meta.continueFromPrevious && previousParsedShot !== undefined;
      if (shot.meta.continueFromPrevious && !previousParsedShot) {
        planWarnings.push(
          `${shot.id}: continueFromPrevious was ignored because there is no prior clip to extend.`,
        );
      }

      const referenceSelection = await selectReferences(parsedProject, shot, willUseVideoExtension);
      const shotWarnings = [...referenceSelection.warnings];
      const durationSec = normalizeDuration(
        shot,
        project,
        referenceSelection.selected.length > 0,
        shotWarnings,
      );

      totalDurationSec += durationSec;
      if (totalDurationSec > project.maxDurationSec) {
        throw new Error(
          `Planned duration reached ${totalDurationSec}s, which exceeds project maxDurationSec=${project.maxDurationSec}.`,
        );
      }

      const prompt = buildShotPrompt({
        project,
        scene: scene as ParsedScene,
        shot: {
          ...shot,
          durationSec,
        },
        previousShot: previousParsedShot,
        hasReferenceImages: referenceSelection.selected.length > 0,
      });

      const clipBaseName = `${formatIndex(shot.globalIndex)}-${shot.id}.mp4`;
      const promptBaseName = `${formatIndex(shot.globalIndex)}-${shot.id}.txt`;

      shots.push({
        id: shot.id,
        globalIndex: shot.globalIndex,
        sceneId: shot.sceneId,
        sceneTitle: scene.title,
        title: shot.title,
        durationSec,
        mode: willUseVideoExtension ? "video-extension" : "text-to-video",
        prompt,
        promptTokenEstimate: estimateTokenCount(prompt),
        promptPath: path.join(runDir, "prompts", promptBaseName),
        outputPath: path.join(runDir, "clips", clipBaseName),
        characters: shot.meta.characters,
        selectedReferences: referenceSelection.selected,
        droppedReferences: referenceSelection.dropped,
        warnings: shotWarnings,
        metadata: shot.meta,
      });

      previousParsedShot = shot;
    }
  }

  return {
    createdAt: new Date().toISOString(),
    scriptPath: parsedProject.scriptPath,
    runDir,
    project,
    totalDurationSec,
    warnings: planWarnings,
    shots,
  };
}

export async function planProject(
  options: BuildPlanOptions & { scriptPath: string; jsonOutputPath?: string },
): Promise<RenderPlan> {
  const plan = await buildRenderPlan(options);

  if (options.jsonOutputPath) {
    await ensureDir(path.dirname(path.resolve(options.jsonOutputPath)));
    await writeJson(path.resolve(options.jsonOutputPath), plan);
  }

  return plan;
}

export async function renderProject(
  options: RenderProjectOptions & { scriptPath: string },
): Promise<RenderManifest> {
  const plan = await buildRenderPlan(options);
  await materializePlan(plan);

  const manifest = initializeManifest(plan);
  await persistManifest(manifest);

  if (options.dryRun) {
    return manifest;
  }

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for render. Use --dry-run to generate plan artifacts only.");
  }

  const client = new GeminiVideoClient(apiKey);
  const pollMs = options.pollMs ?? 10000;
  const interShotDelayMs = options.interShotDelayMs ?? 20_000;

  for (const [index, shot] of manifest.shots.entries()) {
    try {
      const previousCompletedShot =
        shot.mode === "video-extension"
          ? manifest.shots
              .slice(0, shot.globalIndex - 1)
              .reverse()
              .find((candidate) => candidate.status === "completed")
          : undefined;

      let result;
      let lastError: unknown;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          result = await client.generateClip({
            model: plan.project.model,
            prompt: shot.prompt,
            outputPath: shot.outputPath,
            durationSec: shot.durationSec,
            aspectRatio: plan.project.aspectRatio,
            resolution: plan.project.resolution,
            personGeneration: resolveShotPersonGeneration(shot, plan.project),
            enhancePrompt: plan.project.enhancePrompt,
            generateAudio: plan.project.generateAudio,
            negativePrompt: plan.project.negativePrompt,
            seed:
              plan.project.seed !== undefined
                ? plan.project.seed + shot.metadata.seedOffset + shot.globalIndex - 1
                : undefined,
            pollMs,
            referenceImages: shot.selectedReferences.map((reference) => {
              return {
                absolutePath: reference.absolutePath,
                referenceType: reference.referenceType,
              };
            }),
            previousVideoPath: previousCompletedShot?.outputPath,
          });
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (attempt === 3 || !isTransientRenderError(error)) {
            throw error;
          }
        }
      }

      if (!result) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }

      shot.status = "completed";
      shot.operationName = result.operationName;
      shot.remoteUri = result.remoteUri;
      await persistManifest(manifest);

      if (index < manifest.shots.length - 1) {
        await sleep(interShotDelayMs);
      }
    } catch (error) {
      shot.status = "failed";
      shot.error = error instanceof Error ? error.message : String(error);
      await persistManifest(manifest);
      throw error;
    }
  }

  if (!options.skipStitch) {
    const clipPaths = collectClipPaths(manifest);
    if (clipPaths.length > 1) {
      const finalVideoPath = path.join(plan.runDir, "final-video.mp4");
      await stitchVideos(clipPaths, finalVideoPath);
      manifest.finalVideoPath = finalVideoPath;
      await persistManifest(manifest);
    }
  }

  return manifest;
}

export async function stitchFromManifest(
  manifestPath: string,
  explicitOutputPath?: string,
): Promise<string> {
  const absoluteManifestPath = path.resolve(manifestPath);
  const manifest = JSON.parse(await fs.readFile(absoluteManifestPath, "utf8")) as RenderManifest;
  const clipPaths = collectClipPaths(manifest);
  const outputPath =
    explicitOutputPath !== undefined
      ? path.resolve(explicitOutputPath)
      : path.join(manifest.runDir, "final-video.mp4");

  await stitchVideos(clipPaths, outputPath);
  manifest.finalVideoPath = outputPath;
  await persistManifest(manifest);
  return outputPath;
}

export function summarizePlan(plan: RenderPlan): string {
  const lines = [
    `Plan ready for ${plan.project.title}`,
    `Script: ${relativeToCwd(plan.scriptPath)}`,
    `Run dir: ${relativeToCwd(plan.runDir)}`,
    `Model: ${plan.project.model}`,
    `Total duration: ${plan.totalDurationSec}s / max ${plan.project.maxDurationSec}s`,
    `Shots: ${plan.shots.length}`,
  ];

  for (const shot of plan.shots) {
    const referenceSummary =
      shot.selectedReferences.length > 0 ? `refs=${shot.selectedReferences.length}` : "refs=0";
    lines.push(
      `${formatIndex(shot.globalIndex)} ${shot.sceneTitle} / ${shot.title} [${shot.mode}, ${shot.durationSec}s, ${referenceSummary}]`,
    );
    for (const warning of shot.warnings) {
      lines.push(`  warning: ${warning}`);
    }
  }

  for (const warning of plan.warnings) {
    lines.push(`warning: ${warning}`);
  }

  return lines.join("\n");
}
