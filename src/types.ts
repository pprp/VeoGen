import { z } from "zod";

export const referenceTypeSchema = z.enum(["ASSET", "STYLE"]);
export type ReferenceType = z.infer<typeof referenceTypeSchema>;

export const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  look: z.string().optional(),
  wardrobe: z.string().optional(),
  voice: z.string().optional(),
  mannerisms: z.string().optional(),
  referenceImages: z.array(z.string()).default([]),
});

export const projectConfigSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().optional(),
  model: z.string().default(process.env.VEO_MODEL ?? "veo-3.0-generate-preview"),
  aspectRatio: z.enum(["16:9", "9:16"]).default("16:9"),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  maxDurationSec: z.number().int().positive().max(120).default(120),
  defaultClipDurationSec: z.number().int().positive().max(8).default(8),
  generateAudio: z.boolean().default(true),
  enhancePrompt: z.boolean().default(true),
  personGeneration: z.enum(["allow_adult", "dont_allow", "allow_all"]).default("allow_adult"),
  negativePrompt: z.string().optional(),
  style: z.string().optional(),
  styleReferenceImages: z.array(z.string()).default([]),
  outputDir: z.string().default("outputs"),
  seed: z.number().int().optional(),
  characters: z.array(characterSchema).default([]),
});

export const shotMetaSchema = z.object({
  durationSec: z.number().int().positive().max(8).optional(),
  characters: z.array(z.string()).default([]),
  location: z.string().optional(),
  timeOfDay: z.string().optional(),
  camera: z.string().optional(),
  movement: z.string().optional(),
  mood: z.string().optional(),
  sound: z.string().optional(),
  references: z.array(z.string()).default([]),
  continueFromPrevious: z.boolean().default(false),
  transition: z.string().optional(),
  seedOffset: z.number().int().default(0),
});

export type Character = z.infer<typeof characterSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type ShotMeta = z.infer<typeof shotMetaSchema>;

export interface ParsedShot {
  id: string;
  sceneId: string;
  sceneIndex: number;
  shotIndex: number;
  globalIndex: number;
  title: string;
  body: string;
  durationSec: number;
  meta: ShotMeta;
}

export interface ParsedScene {
  id: string;
  index: number;
  title: string;
  synopsis?: string;
  shots: ParsedShot[];
}

export interface ParsedProject {
  scriptPath: string;
  project: ProjectConfig;
  scenes: ParsedScene[];
  totalDurationSec: number;
}

export interface SelectedReference {
  sourcePath: string;
  absolutePath: string;
  referenceType: ReferenceType;
  sourceLabel: string;
}

export interface PlannedShot {
  id: string;
  globalIndex: number;
  sceneId: string;
  sceneTitle: string;
  title: string;
  durationSec: number;
  mode: "text-to-video" | "video-extension";
  prompt: string;
  promptTokenEstimate: number;
  promptPath: string;
  outputPath: string;
  characters: string[];
  selectedReferences: SelectedReference[];
  droppedReferences: SelectedReference[];
  warnings: string[];
  metadata: ShotMeta;
}

export interface RenderPlan {
  createdAt: string;
  scriptPath: string;
  runDir: string;
  project: ProjectConfig;
  totalDurationSec: number;
  warnings: string[];
  shots: PlannedShot[];
}

export interface ManifestShot extends PlannedShot {
  status: "pending" | "completed" | "failed" | "skipped";
  operationName?: string;
  remoteUri?: string;
  error?: string;
}

export interface RenderManifest extends Omit<RenderPlan, "shots"> {
  shots: ManifestShot[];
  finalVideoPath?: string;
}
