import path from "node:path";
import { promises as fs } from "node:fs";

import YAML from "yaml";

import { parseMarkdownScript } from "./markdown.js";
import { renderProject } from "./orchestrator.js";
import { GeminiCreativeClient, type GeminiCreativeLikeClient } from "./gemini-creative.js";
import type {
  ParsedProject,
  ParsedScene,
  ParsedShot,
  RenderManifest,
} from "./types.js";
import { ensureDir, relativeToCwd, safeSlug, timestampId, normalizeVeoModelName } from "./utils.js";

type AspectRatio = "16:9" | "9:16";
type Resolution = "720p" | "1080p";
type PersonGeneration = "allow_adult" | "dont_allow";
type SourceMode = "idea" | "script";

interface DevelopmentCharacter {
  id: string;
  name: string;
  role: string;
  description: string;
  look: string;
  wardrobe: string;
  voice: string;
  mannerisms: string;
  personalityHook: string;
}

interface DevelopmentShot {
  title: string;
  summary: string;
  characters: string[];
  durationSec: number;
  location: string;
  timeOfDay: string;
  camera: string;
  movement: string;
  mood: string;
  sound: string;
  transition: string;
  continueFromPrevious: boolean;
  dialogue: string[];
}

interface DevelopmentScene {
  title: string;
  synopsis: string;
  shots: DevelopmentShot[];
}

interface StoryDevelopmentSpec {
  title: string;
  synopsis: string;
  style: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  defaultClipDurationSec: number;
  maxDurationSec: number;
  personGeneration: PersonGeneration;
  negativePrompt: string;
  characters: DevelopmentCharacter[];
  scenes: DevelopmentScene[];
}

interface ScriptReviewReport {
  verdict: "approved" | "revise_lightly" | "revise_heavily";
  strengths: string[];
  risks: string[];
  requiredChanges: string[];
  continuityNotes: string[];
}

interface CharacterAsset {
  id: string;
  name: string;
  imagePrompt: string;
  imagePath?: string;
  lineupPosition?: number;
  lineupSize?: number;
  status: "generated" | "skipped" | "failed";
  revision: number;
  notes: string[];
}

interface CharacterPack {
  iteration: number;
  globalStyleAnchor: string;
  lineupPrompt?: string;
  lineupImagePath?: string;
  characters: CharacterAsset[];
}

interface CharacterEvaluationCharacterNote {
  id: string;
  needsRevision: boolean;
  styleAlignmentScore: number;
  consistency: string;
  distinctiveness: string;
  refinementAdvice: string[];
}

interface CharacterEvaluationReport {
  styleConsistencyScore: number;
  overallNotes: string[];
  recommendedGlobalAdjustments: string[];
  characters: CharacterEvaluationCharacterNote[];
}

interface DirectorShotObjective {
  sceneTitle: string;
  shotTitle: string;
  objective: string;
  visualDirective: string;
  editHint: string;
}

interface DirectorReport {
  globalDirection: string[];
  stitchingPlan: string[];
  finalLookNotes: string[];
  shotObjectives: DirectorShotObjective[];
}

interface AgentRun {
  name: string;
  mode: "gemini" | "fallback" | "ingested";
  artifactPath: string;
  warnings: string[];
}

export interface CreativePipelineOptions {
  idea?: string;
  ideaFilePath?: string;
  scriptPath?: string;
  scriptText?: string;
  outputDir?: string;
  dryRun?: boolean;
  render?: boolean;
  skipRender?: boolean;
  skipCharacterImages?: boolean;
  modelOverride?: string;
  pollMs?: number;
  interShotDelayMs?: number;
  apiKey?: string;
  characterConsistencyThreshold?: number;
  maxCharacterRefinementRounds?: number;
  geminiCreativeClient?: GeminiCreativeLikeClient;
}

export interface CreativePipelineResult {
  runDir: string;
  developmentDir: string;
  refsDir: string;
  finalScriptPath: string;
  renderRequested: boolean;
  renderManifest?: RenderManifest;
  renderManifestPath?: string;
  finalVideoPath?: string;
  sourceMode: SourceMode;
  warnings: string[];
  agentRuns: AgentRun[];
  finalCharacterConsistencyScore?: number;
  characterRefinementRoundsApplied: number;
}

const defaultPipelineModel = process.env.GEMINI_PIPELINE_MODEL ?? "gemini-2.5-flash";
const defaultReviewModel = process.env.GEMINI_REVIEW_MODEL ?? defaultPipelineModel;
const defaultEvaluatorModel = process.env.GEMINI_EVALUATOR_MODEL ?? defaultPipelineModel;
const defaultDirectorModel = process.env.GEMINI_DIRECTOR_MODEL ?? defaultPipelineModel;
const defaultCharacterImageModel = process.env.GEMINI_CHARACTER_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const defaultCharacterEditModel = process.env.GEMINI_CHARACTER_EDIT_MODEL ?? defaultCharacterImageModel;
const defaultCharacterConsistencyThreshold = Number(process.env.CHARACTER_CONSISTENCY_THRESHOLD ?? "85");
const defaultMaxCharacterRefinementRounds = Number(process.env.MAX_CHARACTER_REFINEMENT_ROUNDS ?? "2");

const storySpecSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "synopsis",
    "style",
    "aspectRatio",
    "resolution",
    "defaultClipDurationSec",
    "maxDurationSec",
    "personGeneration",
    "negativePrompt",
    "characters",
    "scenes",
  ],
  properties: {
    title: { type: "string" },
    synopsis: { type: "string" },
    style: { type: "string" },
    aspectRatio: { type: "string", enum: ["16:9", "9:16"] },
    resolution: { type: "string", enum: ["720p", "1080p"] },
    defaultClipDurationSec: { type: "integer", minimum: 1, maximum: 8 },
    maxDurationSec: { type: "integer", minimum: 8, maximum: 120 },
    personGeneration: { type: "string", enum: ["allow_adult", "dont_allow"] },
    negativePrompt: { type: "string" },
    characters: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "name",
          "role",
          "description",
          "look",
          "wardrobe",
          "voice",
          "mannerisms",
          "personalityHook",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          role: { type: "string" },
          description: { type: "string" },
          look: { type: "string" },
          wardrobe: { type: "string" },
          voice: { type: "string" },
          mannerisms: { type: "string" },
          personalityHook: { type: "string" },
        },
      },
    },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "synopsis", "shots"],
        properties: {
          title: { type: "string" },
          synopsis: { type: "string" },
          shots: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "title",
                "summary",
                "characters",
                "durationSec",
                "location",
                "timeOfDay",
                "camera",
                "movement",
                "mood",
                "sound",
                "transition",
                "continueFromPrevious",
                "dialogue",
              ],
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                characters: {
                  type: "array",
                  items: { type: "string" },
                },
                durationSec: { type: "integer", minimum: 1, maximum: 8 },
                location: { type: "string" },
                timeOfDay: { type: "string" },
                camera: { type: "string" },
                movement: { type: "string" },
                mood: { type: "string" },
                sound: { type: "string" },
                transition: { type: "string" },
                continueFromPrevious: { type: "boolean" },
                dialogue: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};

const reviewSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "strengths", "risks", "requiredChanges", "continuityNotes"],
  properties: {
    verdict: { type: "string", enum: ["approved", "revise_lightly", "revise_heavily"] },
    strengths: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    requiredChanges: { type: "array", items: { type: "string" } },
    continuityNotes: { type: "array", items: { type: "string" } },
  },
};

const characterEvaluationSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["styleConsistencyScore", "overallNotes", "recommendedGlobalAdjustments", "characters"],
  properties: {
    styleConsistencyScore: { type: "integer", minimum: 0, maximum: 100 },
    overallNotes: { type: "array", items: { type: "string" } },
    recommendedGlobalAdjustments: { type: "array", items: { type: "string" } },
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "needsRevision", "styleAlignmentScore", "consistency", "distinctiveness", "refinementAdvice"],
        properties: {
          id: { type: "string" },
          needsRevision: { type: "boolean" },
          styleAlignmentScore: { type: "integer", minimum: 0, maximum: 100 },
          consistency: { type: "string" },
          distinctiveness: { type: "string" },
          refinementAdvice: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const directorSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["globalDirection", "stitchingPlan", "finalLookNotes", "shotObjectives"],
  properties: {
    globalDirection: { type: "array", items: { type: "string" } },
    stitchingPlan: { type: "array", items: { type: "string" } },
    finalLookNotes: { type: "array", items: { type: "string" } },
    shotObjectives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sceneTitle", "shotTitle", "objective", "visualDirective", "editHint"],
        properties: {
          sceneTitle: { type: "string" },
          shotTitle: { type: "string" },
          objective: { type: "string" },
          visualDirective: { type: "string" },
          editHint: { type: "string" },
        },
      },
    },
  },
};

function createFallbackTitle(input: string): string {
  const words = input
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  if (words.length === 0) {
    return "Autogenerated Short";
  }

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function ensureNegativePromptTerms(value: string): string {
  const requiredTerms = [
    "subtitles",
    "captions",
    "transcript text",
    "burned-in dialogue words",
    "lower-third text",
    "visible typography",
    "readable text",
    "watermarks",
    "logos",
  ];
  const normalized = normalizeText(value || "warped anatomy, duplicate people, flicker");
  const lower = normalized.toLowerCase();
  const missingTerms = requiredTerms.filter((term) => !lower.includes(term.toLowerCase()));
  return [...[normalized], ...missingTerms].filter(Boolean).join(", ");
}

function safeCharacterId(value: string, fallbackIndex: number): string {
  const slug = safeSlug(value).replace(/-/g, "_");
  return slug.length > 0 ? slug : `character_${fallbackIndex + 1}`;
}

function normalizeCharacter(
  character: DevelopmentCharacter,
  index: number,
): DevelopmentCharacter {
  return {
    id: safeCharacterId(character.id || character.name || `character_${index + 1}`, index),
    name: normalizeText(character.name || `角色${index + 1}`),
    role: normalizeText(character.role || "主角"),
    description: normalizeText(character.description || "适合短片表达的核心角色"),
    look: normalizeText(character.look || character.description || "轮廓鲜明，便于一眼识别"),
    wardrobe: normalizeText(character.wardrobe || "符合剧情场景的服装"),
    voice: normalizeText(character.voice || "有辨识度的中文声线"),
    mannerisms: normalizeText(character.mannerisms || "动作有目的且能透露人物状态"),
    personalityHook: normalizeText(character.personalityHook || "有明确但未说破的内在冲突"),
  };
}

function normalizeShot(shot: DevelopmentShot, clipDuration: number): DevelopmentShot {
  return {
    title: normalizeText(shot.title || "镜头"),
    summary: normalizeText(shot.summary || "推进剧情的关键拍点"),
    characters: shot.characters.filter(Boolean),
    durationSec: Math.min(8, Math.max(1, Math.round(shot.durationSec || clipDuration))),
    location: normalizeText(shot.location || ""),
    timeOfDay: normalizeText(shot.timeOfDay || ""),
    camera: normalizeText(shot.camera || ""),
    movement: normalizeText(shot.movement || ""),
    mood: normalizeText(shot.mood || ""),
    sound: normalizeText(shot.sound || ""),
    transition: normalizeText(shot.transition || ""),
    continueFromPrevious: Boolean(shot.continueFromPrevious),
    dialogue: shot.dialogue.map((line) => normalizeText(line)).filter(Boolean),
  };
}

function normalizeStorySpec(raw: StoryDevelopmentSpec): StoryDevelopmentSpec {
  const defaultClipDurationSec = Math.min(8, Math.max(1, Math.round(raw.defaultClipDurationSec || 8)));
  const characters = raw.characters.map((character, index) => normalizeCharacter(character, index));
  const characterIds = new Set(characters.map((character) => character.id));

  const scenes = raw.scenes
    .map((scene) => {
      return {
        title: normalizeText(scene.title || "Scene"),
        synopsis: normalizeText(scene.synopsis || ""),
        shots: scene.shots
          .map((shot) => normalizeShot(shot, defaultClipDurationSec))
          .map((shot) => {
            const filteredCharacters = shot.characters.filter((characterId) => characterIds.has(characterId));
            return {
              ...shot,
              characters: filteredCharacters,
            };
          }),
      };
    })
    .filter((scene) => scene.shots.length > 0);

  if (scenes.length === 0) {
    throw new Error("Creative pipeline could not normalize any shots for the final script.");
  }

  const totalDurationSec = scenes.reduce((sum, scene) => {
    return sum + scene.shots.reduce((sceneSum, shot) => sceneSum + shot.durationSec, 0);
  }, 0);

  return {
    title: normalizeText(raw.title || "自动生成短片"),
    synopsis: normalizeText(raw.synopsis || ""),
    style: normalizeText(raw.style || "电影级短片"),
    aspectRatio: raw.aspectRatio === "9:16" ? "9:16" : "16:9",
    resolution: raw.resolution === "1080p" ? "1080p" : "720p",
    defaultClipDurationSec,
    maxDurationSec: Math.min(120, Math.max(totalDurationSec, Math.round(raw.maxDurationSec || 120))),
    personGeneration: raw.personGeneration === "dont_allow" ? "dont_allow" : "allow_adult",
    negativePrompt: ensureNegativePromptTerms(raw.negativePrompt || "warped anatomy, duplicate people, flicker, subtitles, watermarks"),
    characters,
    scenes,
  };
}

function buildFallbackStorySpec(ideaOrScript: string): StoryDevelopmentSpec {
  const seedText = normalizeText(ideaOrScript);
  const title = seedText.length > 0 ? `自动短片：${createFallbackTitle(seedText)}` : "自动生成短片";
  const leadName = "林夏";
  const counterpartName = "周焰";

  return normalizeStorySpec({
    title,
    synopsis: seedText.length > 0
      ? `基于输入设想扩写的一支中文短片，核心冲突围绕“${seedText}”展开。`
      : "基于输入设想扩写的一支中文短片。",
    style: "电影级短片，动作清晰，轮廓鲜明，灯光与色彩连续统一",
    aspectRatio: "16:9",
    resolution: "720p",
    defaultClipDurationSec: 8,
    maxDurationSec: 120,
    personGeneration: "allow_adult",
    negativePrompt: "warped anatomy, duplicate people, flicker, subtitles, watermarks, broken continuity",
    characters: [
      {
        id: "lin_xia",
        name: leadName,
        role: "主角",
        description: seedText.length > 0
          ? `被卷入这场事件中心的人，她的每一步都直接推动“${seedText}”这条主线。`
          : "被卷入事件中心的人，她的每一步都推动主线向前。",
        look: "轮廓鲜明，五官有记忆点，眼神里同时带着疲惫和决心",
        wardrobe: "符合剧情世界观的标志性服装，并保留一个容易识别的强调色",
        voice: "克制但情绪压得很满的中文声线",
        mannerisms: "动作小而准，做决定前会短暂停顿观察",
        personalityHook: "明明很急，却始终强迫自己保持克制",
      },
      {
        id: "zhou_yan",
        name: counterpartName,
        role: "对照角色",
        description: "给主角制造摩擦、支撑或反问的人，让剧情冲突更直接地显形。",
        look: "与主角在体态和重心上明显不同，但仍处在同一视觉体系里",
        wardrobe: "和主角互补但不重复的服装轮廓与材质语言",
        voice: "沉稳、简短、带潜台词的中文声线",
        mannerisms: "站姿更保护性，目光更锋利，动作控制得更稳",
        personalityHook: "表面很笃定，真正害怕的东西却从不说出来",
      },
    ],
    scenes: [
      {
        title: "开场",
        synopsis: "先用一个一眼能懂的画面交代处境、世界规则和情绪压力。",
        shots: [
          {
            title: "世界建立",
            summary: seedText.length > 0
              ? `先用一个能立刻说明“${seedText}”核心处境的画面把观众拽进故事。`
              : "先用一个能立刻说明主线处境的画面把观众拽进故事。",
            characters: ["lin_xia"],
            durationSec: 8,
            location: "故事最核心的主环境",
            timeOfDay: "清晨、黄昏或带戏剧感的光线时段",
            camera: "宽幅建立镜头，先交代空间再收向人物",
            movement: "缓慢向内推进",
            mood: "好奇里带着不安",
            sound: "环境底噪加一个很简单但持续逼近的节奏点",
            transition: "",
            continueFromPrevious: false,
            dialogue: [],
          },
          {
            title: "冲突现身",
            summary: "让主角的眼前阻力和第二个关键人物同时出现，局面立刻紧起来。",
            characters: ["lin_xia", "zhou_yan"],
            durationSec: 8,
            location: "同一空间里更近、更压迫的一处",
            timeOfDay: "连续",
            camera: "中景，优先看清表情和身体关系",
            movement: "缓慢逼近情绪转折点",
            mood: "紧张正在上升",
            sound: "贴身动静、呼吸声、克制的配乐",
            transition: "顺着视线或动作切入",
            continueFromPrevious: true,
            dialogue: [
              `${leadName}: 我们已经没有犹豫的时间了。`,
              `${counterpartName}: 那你就别再把这一切当演练。`,
            ],
          },
        ],
      },
      {
        title: "升级",
        synopsis: "把人物推向更难的选择，同时让短片的视觉语言变得更明确。",
        shots: [
          {
            title: "压力逼近",
            summary: "环境和人物关系同时收紧，让观众感到退路正在消失。",
            characters: ["lin_xia", "zhou_yan"],
            durationSec: 8,
            location: "这个世界里最压缩、最危险的一段空间",
            timeOfDay: "连续",
            camera: "更紧的机位，加一点有动机的视差",
            movement: "环绕或侧移，让压迫感继续增加",
            mood: "急、乱、情绪快压不住",
            sound: "脉冲式配乐叠加环境尖锐音",
            transition: "承接上一镜头的动作余势",
            continueFromPrevious: true,
            dialogue: [],
          },
          {
            title: "情感揭露",
            summary: "让两个人终于说出一点真话，观众才能真正理解他们各自想守住什么。",
            characters: ["lin_xia", "zhou_yan"],
            durationSec: 8,
            location: "同一场景里相对安静的一个角落",
            timeOfDay: "连续",
            camera: "交替近景，盯住眼神变化",
            movement: "尽量少动，留住对视压力",
            mood: "脆弱，但已经不再逃避",
            sound: "配乐后退，给沉默和现场空气留位置",
            transition: "用情绪硬切进下一拍",
            continueFromPrevious: false,
            dialogue: [
              `${leadName}: 这件事我可以扛，但我扛不动下一次谎话了。`,
              `${counterpartName}: 那就让这一次，真的是最后一次。`,
            ],
          },
        ],
      },
      {
        title: "爆点",
        synopsis: "把情绪和动作一起推到顶，然后落在一个干净、能留下余味的结尾画面。",
        shots: [
          {
            title: "做出选择",
            summary: "两个人终于不再摇摆，用一个明确动作把最终立场落地。",
            characters: ["lin_xia", "zhou_yan"],
            durationSec: 8,
            location: "故事高潮发生的核心空间",
            timeOfDay: "连续",
            camera: "带决断感的中大全景",
            movement: "坚定向前",
            mood: "决绝、带冲劲、情绪释放",
            sound: "音乐推到峰值，动作音更扎实",
            transition: "砸切或匹配切入最后一张画面",
            continueFromPrevious: false,
            dialogue: [],
          },
          {
            title: "最后一击",
            summary: "用一个一眼能记住的姿态或轮廓收尾，让情绪停在观众心里。",
            characters: ["lin_xia"],
            durationSec: 8,
            location: "同一个高潮空间，但画面被压缩得更干净",
            timeOfDay: "连续",
            camera: "干净明确的收尾构图",
            movement: "静止或极慢漂移",
            mood: "事情结束了，但余痛还在",
            sound: "音乐收住，只留一个最有记忆点的环境声",
            transition: "",
            continueFromPrevious: false,
            dialogue: [],
          },
        ],
      },
    ],
  });
}

function parsedProjectToDevelopmentSpec(parsedProject: ParsedProject): StoryDevelopmentSpec {
  return normalizeStorySpec({
    title: parsedProject.project.title,
    synopsis: parsedProject.project.synopsis ?? "",
    style: parsedProject.project.style ?? "cinematic short film",
    aspectRatio: parsedProject.project.aspectRatio,
    resolution: parsedProject.project.resolution,
    defaultClipDurationSec: parsedProject.project.defaultClipDurationSec,
    maxDurationSec: parsedProject.project.maxDurationSec,
    personGeneration: parsedProject.project.personGeneration,
    negativePrompt: parsedProject.project.negativePrompt ?? "",
    characters: parsedProject.project.characters.map((character) => {
      return {
        id: character.id,
        name: character.name,
        role: "cast member",
        description: character.description,
        look: character.look ?? "",
        wardrobe: character.wardrobe ?? "",
        voice: character.voice ?? "",
        mannerisms: character.mannerisms ?? "",
        personalityHook: character.mannerisms ?? character.description,
      };
    }),
    scenes: parsedProject.scenes.map((scene: ParsedScene) => {
      return {
        title: scene.title,
        synopsis: scene.synopsis ?? "",
        shots: scene.shots.map((shot: ParsedShot) => {
          return {
            title: shot.title,
            summary: shot.body,
            characters: shot.meta.characters,
            durationSec: shot.durationSec,
            location: shot.meta.location ?? "",
            timeOfDay: shot.meta.timeOfDay ?? "",
            camera: shot.meta.camera ?? "",
            movement: shot.meta.movement ?? "",
            mood: shot.meta.mood ?? "",
            sound: shot.meta.sound ?? "",
            transition: shot.meta.transition ?? "",
            continueFromPrevious: shot.meta.continueFromPrevious,
            dialogue: [],
          };
        }),
      };
    }),
  });
}

function buildStoryWriterSystemPrompt(): string {
  return [
    "You are the Script Writer Agent for an automated short-film pipeline.",
    "Convert the source idea or script into a structured short-film development spec.",
    "Requirements:",
    "- all story-facing text must default to natural Simplified Chinese, including title, synopsis, character names, scene titles, shot titles, summaries, sound notes, and dialogue",
    "- keep technical enum values and schema keys unchanged; use lowercase ASCII ids for character ids",
    "- keep the result feasible for a short film up to 120 seconds",
    "- create 1 to 3 major characters with distinct personalities",
    "- create 3 to 6 scenes total",
    "- each shot must be renderable as a self-contained Veo clip",
    "- each shot duration must be between 1 and 8 seconds",
    "- keep character ids stable and lowercase-friendly",
    "- prefer expressive, filmable visual action over exposition",
  ].join("\n");
}

function buildStoryWriterUserPrompt(
  sourceMode: SourceMode,
  sourceText: string,
  existingSpec?: StoryDevelopmentSpec,
): string {
  const sections = [
    `Source mode: ${sourceMode}`,
    "Create a compact, production-ready development spec for a stylized short film.",
    "If the source is already a script, preserve the story while strengthening cinematic clarity.",
    "If the source is only an idea, invent the missing specifics with strong visual logic.",
    "Default to Simplified Chinese for all story-facing text while preserving technical fields that must stay schema-compatible.",
  ];

  if (existingSpec) {
    sections.push(
      "If the parsed script structure below is usable, preserve its shot order, character ids, and technical constraints while rewriting the story-facing text into concise natural Chinese.",
      "Parsed script structure:",
      JSON.stringify(existingSpec, null, 2),
    );
  }

  sections.push("", sourceText);
  return sections.join("\n");
}

function buildReviewSystemPrompt(): string {
  return [
    "You are the Script Review Agent.",
    "Review the proposed short-film development spec for cinematic clarity, emotional logic, character consistency, and renderability.",
    "Return concise findings that a downstream Director Agent can act on.",
  ].join("\n");
}

function buildScriptRevisionSystemPrompt(): string {
  return [
    "You are the Script Revision Agent.",
    "Apply the review feedback to the short-film development spec while preserving the core premise and production feasibility.",
    "Return all story-facing text in natural Simplified Chinese unless the user explicitly requested another language.",
    "Keep character ids stable, keep the runtime within 120 seconds, and return a full revised development spec.",
  ].join("\n");
}

function buildDirectorSystemPrompt(): string {
  return [
    "You are the Director Agent for a short-film pipeline.",
    "Your job is to turn a reviewed story spec into specific shot intentions and stitching guidance.",
    "Return natural Simplified Chinese for all story-facing notes and shot objectives.",
    "Be concrete about visual emphasis, continuity, and edit rhythm.",
  ].join("\n");
}

function buildScriptRevisionUserPrompt(
  spec: StoryDevelopmentSpec,
  review: ScriptReviewReport,
): string {
  return [
    "Original development spec:",
    JSON.stringify(spec, null, 2),
    "",
    "Review feedback:",
    JSON.stringify(review, null, 2),
    "",
    "Return the fully revised development spec.",
  ].join("\n");
}

function buildStyleLock(spec: StoryDevelopmentSpec): string[] {
  return [
    `Primary style anchor: ${spec.style}`,
    "Choose one single visual family for the entire project and keep it locked across all characters, shots, and revisions.",
    "Do not alternate between photoreal live-action, anime, cel-shaded cartoon, painterly illustration, comic-book art, or stylized 3D looks.",
    "Keep facial proportion rules, shading logic, texture density, color response, line treatment, and lighting behavior consistent across the whole film.",
    "If one character is rendered more cartoonish or more realistic than the others, treat that as a failure and pull it back to the shared visual family.",
    "Do not include visible typography, labels, captions, annotations, name cards, UI panels, handwritten notes, logos, watermarks, or explanatory text inside reference images.",
  ];
}

function formatCharacterLineupEntry(character: DevelopmentCharacter): string {
  return [
    `- ${character.id} / ${character.name} (${character.role})`,
    `description: ${character.description}`,
    `look: ${character.look}`,
    `wardrobe: ${character.wardrobe}`,
    `mannerisms: ${character.mannerisms}`,
  ].join("; ");
}

function createCastLineupPrompt(spec: StoryDevelopmentSpec): string {
  return [
    "Create one unified cast lineup reference image for a short film.",
    ...buildStyleLock(spec),
    "All characters must appear together on the same canvas with the same camera/lens logic, pose language, lighting setup, line treatment, shading model, texture density, and color response.",
    "Arrange the characters left to right in exactly the order listed below. Keep each full body visible and separated so later prompts can identify a target by position.",
    "This image is the canonical visual bible for every later single-character reference. Do not make one character look like a different artist, medium, or rendering engine created them.",
    "Characters:",
    ...spec.characters.map(formatCharacterLineupEntry),
    "Output a clean full-body lineup on a neutral background, production design sheet style, each character clearly separated and readable, with exact wardrobe and era details preserved. No text of any kind; visual identity should be clear from face, hair, silhouette, and wardrobe.",
  ].join(" ");
}

function createCharacterImagePrompt(
  spec: StoryDevelopmentSpec,
  character: DevelopmentCharacter,
  options: { derivedFromLineup?: boolean; lineupPosition?: number; lineupSize?: number } = {},
): string {
  const lineupTarget = options.derivedFromLineup &&
    typeof options.lineupPosition === "number" &&
    typeof options.lineupSize === "number"
    ? `In the attached cast lineup, the target is character ${options.lineupPosition} of ${options.lineupSize} counting from left to right.`
    : undefined;

  return [
    options.derivedFromLineup
      ? "Create a polished single-character design reference derived from the attached cast lineup."
      : "Create a polished character design reference for a short film.",
    ...buildStyleLock(spec),
    lineupTarget,
    options.derivedFromLineup
      ? "The attached cast lineup is a hard identity and style constraint: preserve this character's face family, proportions, line weight, shading, palette, wardrobe construction, and era details. Extract only the requested character; do not include the other cast members, do not create a new lineup, and do not redesign the cast style."
      : undefined,
    `Character name: ${character.name}.`,
    `Character id: ${character.id}.`,
    `Narrative role: ${character.role}.`,
    `Description: ${character.description}.`,
    `Look: ${character.look}.`,
    `Wardrobe: ${character.wardrobe}.`,
    `Voice energy: ${character.voice}.`,
    `Mannerisms: ${character.mannerisms}.`,
    `Personality hook: ${character.personalityHook}.`,
    "Output a single full-body character on a clean neutral background with strong silhouette readability, consistent color design, and production-ready visual consistency. No text blocks, no name labels, no callouts, no side annotations, no UI panels, no typography, no written character names, and no diagram captions.",
  ].filter(Boolean).join(" ");
}

function buildCharacterEvaluationSystemPrompt(): string {
  return [
    "You are the Character Evaluation Agent.",
    "Assess whether the provided character reference images share the same art direction while still giving each lead a distinctive identity.",
    "You are reviewing them for short-film consistency, not standalone illustration quality.",
    "For each character, you must output a boolean `needsRevision` and an integer `styleAlignmentScore` from 0 to 100.",
    "Set `needsRevision=true` whenever the character drifts away from the shared visual family, even if your prose wording varies.",
  ].join("\n");
}

function buildCharacterEvaluationUserPrompt(spec: StoryDevelopmentSpec, characterPack: CharacterPack): string {
  const characterList = characterPack.characters.map((character) => {
    return `- ${character.id} (${character.name}): ${character.notes.join(" ")}`;
  });
  const imageOrder = characterPack.lineupImagePath
    ? [
        "Attached image order:",
        "- image 1: shared cast-lineup master; use it as the canonical style and identity baseline",
        ...characterPack.characters
          .filter((character) => Boolean(character.imagePath))
          .map((character, index) => {
            return `- image ${index + 2}: single-character sheet for ${character.id} (${character.name})`;
          }),
      ]
    : [
        "Attached image order:",
        ...characterPack.characters
          .filter((character) => Boolean(character.imagePath))
          .map((character, index) => {
            return `- image ${index + 1}: single-character sheet for ${character.id} (${character.name})`;
          }),
      ];

  return [
    `Film title: ${spec.title}`,
    "Style lock:",
    ...buildStyleLock(spec),
    ...imageOrder,
    "Character lineup:",
    ...characterList,
    "Review the single-character sheets against each other and, when present, against the shared cast-lineup master.",
    "A character needs revision if the single-character sheet no longer matches the lineup identity, lineup wardrobe, lineup proportions, or lineup visual family.",
    "Explicitly flag any drift where one character looks more anime/cartoon/stylized or more photoreal than the others.",
    "Set `needsRevision=true` for any single-character reference that contains visible typography, names, captions, callouts, annotations, UI panels, watermarks, gibberish text, or typo-like text artifacts.",
  ].join("\n");
}

function getCharacterEvaluationImagePaths(pack: CharacterPack): string[] {
  const imagePaths = [
    pack.lineupImagePath,
    ...pack.characters.map((character) => character.imagePath),
  ].filter((imagePath): imagePath is string => typeof imagePath === "string");

  return [...new Set(imagePaths)];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const text = asString(value);
  return text ? [text] : [];
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asScore(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function textSuggestsStyleRevision(text: string): boolean {
  return /\b(poor|low|drift|deviat|inconsisten|mismatch|clash|failure|violate|redesign|overhaul|anime|cartoon|cel-shaded|photoreal|different artist|different visual|does not match|not match|typography|label|caption|annotation|name card|ui panel|watermark|gibberish|typo|text artifact|visible text|written text)\b/i.test(text);
}

function normalizeCharacterEvaluationReport(
  pack: CharacterPack,
  rawEvaluation: CharacterEvaluationReport,
): CharacterEvaluationReport {
  const rawRecord = asRecord(rawEvaluation) ?? {};
  const overallNotes = asStringArray(rawRecord.overallNotes);
  const recommendedGlobalAdjustments = asStringArray(rawRecord.recommendedGlobalAdjustments);
  const globalText = [...overallNotes, ...recommendedGlobalAdjustments].join(" ");
  const globalTextSuggestsRevision = textSuggestsStyleRevision(globalText);
  const styleConsistencyScore = asScore(rawRecord.styleConsistencyScore) ?? (globalTextSuggestsRevision ? 60 : 82);
  const globalSuggestsRevision = styleConsistencyScore < 70 || globalTextSuggestsRevision;

  const rawCharacters = Array.isArray(rawRecord.characters) ? rawRecord.characters : [];
  const rawCharacterById = new Map<string, Record<string, unknown>>();
  for (const rawCharacter of rawCharacters) {
    const record = asRecord(rawCharacter);
    const id = asString(record?.id);
    if (record && id) {
      rawCharacterById.set(id.toLowerCase(), record);
    }
  }

  const characters = pack.characters.map((character) => {
    const rawCharacter = rawCharacterById.get(character.id.toLowerCase()) ??
      rawCharacterById.get(character.name.toLowerCase());
    const consistency = asString(rawCharacter?.consistency) ??
      (globalSuggestsRevision
        ? "Global evaluation indicates possible style drift for this character."
        : "No character-specific consistency issue returned.");
    const distinctiveness = asString(rawCharacter?.distinctiveness) ??
      "No character-specific distinctiveness note returned.";
    const refinementAdvice = asStringArray(rawCharacter?.refinementAdvice);
    const characterText = [consistency, distinctiveness, ...refinementAdvice].join(" ");
    const characterTextSuggestsRevision = textSuggestsStyleRevision(characterText);
    const explicitScore = asScore(rawCharacter?.styleAlignmentScore);
    const styleAlignmentScore = explicitScore ??
      (characterTextSuggestsRevision
        ? Math.min(styleConsistencyScore, 65)
        : rawCharacter
          ? Math.max(styleConsistencyScore, 70)
          : globalSuggestsRevision
            ? Math.min(styleConsistencyScore, 65)
            : styleConsistencyScore);
    const explicitNeedsRevision = asBoolean(rawCharacter?.needsRevision);

    const inferredNeedsRevision =
      characterTextSuggestsRevision ||
      styleAlignmentScore < 70 ||
      (!rawCharacter && globalSuggestsRevision);

    return {
      id: character.id,
      needsRevision: inferredNeedsRevision || explicitNeedsRevision === true,
      styleAlignmentScore,
      consistency,
      distinctiveness,
      refinementAdvice,
    };
  });

  return {
    styleConsistencyScore,
    overallNotes,
    recommendedGlobalAdjustments,
    characters,
  };
}

function clampConsistencyThreshold(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return defaultCharacterConsistencyThreshold;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampRefinementRounds(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return defaultMaxCharacterRefinementRounds;
  }

  return Math.max(0, Math.min(3, Math.floor(value)));
}

function buildCharacterRevisionPrompt(
  spec: StoryDevelopmentSpec,
  character: DevelopmentCharacter,
  evaluation: CharacterEvaluationCharacterNote | undefined,
  globalAdjustments: string[],
  revision: number,
): string {
  const guidance = [
    ...globalAdjustments,
    ...(evaluation?.refinementAdvice ?? []),
    evaluation?.consistency ? `Consistency note: ${evaluation.consistency}` : "",
    evaluation?.distinctiveness ? `Distinctiveness note: ${evaluation.distinctiveness}` : "",
  ].filter((line) => line.length > 0);

  return [
    createCharacterImagePrompt(spec, character),
    `Revision round: ${revision}.`,
    guidance.length > 0
      ? `Apply these improvements while preserving the same character identity: ${guidance.join(" ")}`
      : "Tighten style consistency and make the silhouette more unmistakable while preserving identity.",
    "Most importantly: pull the character back into the same exact visual family as the rest of the cast. No anime drift, no cartoon drift, no photoreal drift.",
  ].join(" ");
}

function shouldRegenerateCharacters(
  pack: CharacterPack,
  evaluation: CharacterEvaluationReport,
  threshold: number,
  remainingRounds: number,
  client: GeminiCreativeLikeClient | undefined,
  options: CreativePipelineOptions,
): boolean {
  if (!client || options.skipCharacterImages || remainingRounds <= 0) {
    return false;
  }

  if (pack.characters.every((character) => !character.imagePath)) {
    return false;
  }

  return evaluation.styleConsistencyScore < threshold;
}

function shouldRegenerateCharacter(note: CharacterEvaluationCharacterNote | undefined): boolean {
  if (!note) {
    return false;
  }

  return note.needsRevision || note.styleAlignmentScore < 70;
}

function selectStyleMasterAsset(
  pack: CharacterPack,
  evaluation: CharacterEvaluationReport,
): CharacterAsset | undefined {
  const noteById = new Map(evaluation.characters.map((character) => [character.id, character]));
  const candidates = pack.characters
    .filter((character) => Boolean(character.imagePath))
    .map((character) => {
      return {
        asset: character,
        note: noteById.get(character.id),
      };
    })
    .sort((left, right) => {
      const leftScore = left.note?.styleAlignmentScore ?? 0;
      const rightScore = right.note?.styleAlignmentScore ?? 0;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (left.note?.needsRevision !== right.note?.needsRevision) {
        return left.note?.needsRevision ? 1 : -1;
      }

      return left.asset.id.localeCompare(right.asset.id);
    });

  return candidates.at(0)?.asset;
}

function selectRevisionStyleImagePath(
  pack: CharacterPack,
  styleMasterAsset: CharacterAsset | undefined,
  targetAsset: CharacterAsset,
): string | undefined {
  if (pack.lineupImagePath) {
    return pack.lineupImagePath;
  }

  if (styleMasterAsset?.imagePath && styleMasterAsset.id !== targetAsset.id) {
    return styleMasterAsset.imagePath;
  }

  return undefined;
}

function buildDirectorUserPrompt(
  spec: StoryDevelopmentSpec,
  review: ScriptReviewReport,
  evaluation: CharacterEvaluationReport,
): string {
  const scenes = spec.scenes.flatMap((scene) => {
    return scene.shots.map((shot) => {
      return `- ${scene.title} / ${shot.title}: ${shot.summary}`;
    });
  });

  return [
    `Film title: ${spec.title}`,
    `Synopsis: ${spec.synopsis}`,
    "Style lock:",
    ...buildStyleLock(spec),
    `Review verdict: ${review.verdict}`,
    `Review strengths: ${review.strengths.join(" | ")}`,
    `Review risks: ${review.risks.join(" | ")}`,
    `Review required changes: ${review.requiredChanges.join(" | ")}`,
    `Character evaluation score: ${evaluation.styleConsistencyScore}`,
    `Character evaluation notes: ${evaluation.overallNotes.join(" | ")}`,
    "Shot list:",
    ...scenes,
  ].join("\n");
}

function buildFallbackReview(spec: StoryDevelopmentSpec): ScriptReviewReport {
  const shotCount = spec.scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  return {
    verdict: shotCount <= 8 ? "approved" : "revise_lightly",
    strengths: [
      "The story is already broken into filmable shot-sized beats.",
      "The project has clear recurring character anchors.",
    ],
    risks: shotCount > 8 ? ["There may be too many shots for a very short runtime."] : [],
    requiredChanges: [],
    continuityNotes: [
      "Keep wardrobe, silhouette, and prop continuity stable across every appearance.",
    ],
  };
}

function shouldReviseScript(review: ScriptReviewReport): boolean {
  return review.verdict !== "approved" || review.requiredChanges.length > 0;
}

function buildFallbackCharacterEvaluation(
  spec: StoryDevelopmentSpec,
  characterPack: CharacterPack,
): CharacterEvaluationReport {
  return {
    styleConsistencyScore: characterPack.characters.some((character) => character.imagePath) ? 82 : 70,
    overallNotes: [
      `Characters should stay inside this visual world: ${spec.style}.`,
      "Push silhouette contrast and signature wardrobe accents to keep the cast readable.",
    ],
    recommendedGlobalAdjustments: [
      "Reuse the same lighting family and color logic for every major character reference.",
    ],
    characters: characterPack.characters.map((character) => {
      return {
        id: character.id,
        needsRevision: false,
        styleAlignmentScore: characterPack.characters.some((entry) => entry.imagePath) ? 82 : 70,
        consistency: "Matches the intended film style at a high level.",
        distinctiveness: "Needs a stronger signature silhouette or accent detail to read instantly.",
        refinementAdvice: [
          "Strengthen one iconic shape language cue.",
          "Give the wardrobe one unmistakable visual motif.",
        ],
      };
    }),
  };
}

function buildFallbackDirectorReport(spec: StoryDevelopmentSpec): DirectorReport {
  return {
    globalDirection: [
      "优先保证调度方向清楚、肢体关系可读，不要用过于忙乱的镜头运动掩盖叙事。",
      "每一剪都要围绕一个明确的情绪拍点展开，让短片升级得干净利落。",
    ],
    stitchingPlan: [
      "开头先给最容易看懂的建立画面，结尾落在最有记忆点的轮廓或动作上。",
      "优先使用由视线、动作或情绪揭示驱动的硬切。",
    ],
    finalLookNotes: [
      `所有画面都要锁在同一个视觉目标里：${spec.style}。`,
    ],
    shotObjectives: spec.scenes.flatMap((scene) => {
      return scene.shots.map((shot) => {
        return {
          sceneTitle: scene.title,
          shotTitle: shot.title,
          objective: `用一个明确动作和一次情绪转折，把“${scene.title}”这段往前推进。`,
          visualDirective: shot.camera || "保证主体可读、构图受控、视觉重点单一明确。",
          editHint: shot.continueFromPrevious
            ? "和上一拍紧密衔接，优先保持动作连续性。"
            : "在情绪明显变化的瞬间切入。",
        };
      });
    }),
  };
}

function buildDialogueBlock(dialogue: string[]): string {
  return dialogue.length > 0 ? dialogue.join("\n") : "";
}

function buildDirectorBlock(objective?: DirectorShotObjective): string {
  if (!objective) {
    return "";
  }

  return [
    "导演意图：",
    `- 目标：${objective.objective}`,
    `- 视觉重点：${objective.visualDirective}`,
    `- 剪辑提示：${objective.editHint}`,
  ].join("\n");
}

function findShotObjective(
  directorReport: DirectorReport,
  sceneTitle: string,
  shotTitle: string,
): DirectorShotObjective | undefined {
  return directorReport.shotObjectives.find((objective) => {
    return objective.sceneTitle === sceneTitle && objective.shotTitle === shotTitle;
  });
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function resolvePipelineInput(options: CreativePipelineOptions): Promise<{
  sourceMode: SourceMode;
  sourceText: string;
  existingScriptPath?: string;
}> {
  if (options.idea) {
    return {
      sourceMode: "idea",
      sourceText: options.idea.trim(),
    };
  }

  if (options.ideaFilePath) {
    const sourceText = await fs.readFile(path.resolve(options.ideaFilePath), "utf8");
    return {
      sourceMode: "idea",
      sourceText: sourceText.trim(),
    };
  }

  if (options.scriptText) {
    return {
      sourceMode: "script",
      sourceText: options.scriptText.trim(),
    };
  }

  if (options.scriptPath) {
    const absoluteScriptPath = path.resolve(options.scriptPath);
    const sourceText = await fs.readFile(absoluteScriptPath, "utf8");
    return {
      sourceMode: "script",
      sourceText: sourceText.trim(),
      existingScriptPath: absoluteScriptPath,
    };
  }

  throw new Error("pipeline requires one of --idea, --idea-file, --script, or --script-text.");
}

function choosePipelineRunDir(inputText: string, explicitOutputDir?: string): string {
  if (explicitOutputDir) {
    return path.resolve(explicitOutputDir);
  }

  return path.resolve("outputs", `${timestampId()}-${safeSlug(createFallbackTitle(inputText))}-pipeline`);
}

async function ingestExistingMarkdownScript(existingScriptPath: string): Promise<StoryDevelopmentSpec | undefined> {
  try {
    const parsedProject = await parseMarkdownScript(existingScriptPath);
    return parsedProjectToDevelopmentSpec(parsedProject);
  } catch {
    return undefined;
  }
}

function renderSpecToMarkdown(
  spec: StoryDevelopmentSpec,
  directorReport: DirectorReport,
  characterPack: CharacterPack,
  scriptOutputPath: string,
  modelOverride?: string,
): string {
  const refsByCharacterId = new Map<string, string>();
  for (const character of characterPack.characters) {
    if (!character.imagePath) {
      continue;
    }

    const relativeRefPath = path.relative(path.dirname(scriptOutputPath), character.imagePath).replace(/\\/g, "/");
    refsByCharacterId.set(character.id, relativeRefPath);
  }

  const effectiveMaxDurationSec = spec.scenes.reduce((sum, scene) => {
    return (
      sum +
      scene.shots.reduce((sceneSum, shot) => {
        const hasCharacterReference = shot.characters.some((characterId) => refsByCharacterId.has(characterId));
        const effectiveDuration =
          spec.resolution === "1080p" || hasCharacterReference ? 8 : shot.durationSec;
        return sceneSum + effectiveDuration;
      }, 0)
    );
  }, 0);

  const frontmatter = {
    title: spec.title,
    synopsis: spec.synopsis,
    model: normalizeVeoModelName(modelOverride ?? process.env.VEO_MODEL ?? "veo-3.1-generate-preview"),
    aspectRatio: spec.aspectRatio,
    resolution: spec.resolution,
    maxDurationSec: Math.min(120, Math.max(spec.maxDurationSec, effectiveMaxDurationSec)),
    defaultClipDurationSec: spec.defaultClipDurationSec,
    generateAudio: true,
    enhancePrompt: true,
    personGeneration: spec.personGeneration,
    negativePrompt: spec.negativePrompt,
    style: [...buildStyleLock(spec), ...directorReport.finalLookNotes].filter(Boolean).join("; "),
    outputDir: "outputs",
    characters: spec.characters.map((character) => {
      const referencePath = refsByCharacterId.get(character.id);
      return {
        id: character.id,
        name: character.name,
        description: character.description,
        look: character.look,
        wardrobe: character.wardrobe,
        voice: character.voice,
        mannerisms: character.mannerisms,
        ...(referencePath ? { referenceImages: [referencePath] } : {}),
      };
    }),
  };

  const frontmatterYaml = YAML.stringify(frontmatter)
    .replace(/^aspectRatio:\s*(.+)$/m, `aspectRatio: "${spec.aspectRatio}"`)
    .replace(/^resolution:\s*(.+)$/m, `resolution: "${spec.resolution}"`);

  const lines: string[] = ["---", frontmatterYaml.trimEnd(), "---"];

  for (const scene of spec.scenes) {
    lines.push("", `# ${scene.title}`);
    if (scene.synopsis.length > 0) {
      lines.push(scene.synopsis);
    }

    for (const shot of scene.shots) {
      const objective = findShotObjective(directorReport, scene.title, shot.title);
      const shotMeta = {
        durationSec: shot.durationSec,
        characters: shot.characters,
        ...(shot.location ? { location: shot.location } : {}),
        ...(shot.timeOfDay ? { timeOfDay: shot.timeOfDay } : {}),
        ...(shot.camera ? { camera: shot.camera } : {}),
        ...(shot.movement ? { movement: shot.movement } : {}),
        ...(shot.mood ? { mood: shot.mood } : {}),
        ...(shot.sound ? { sound: shot.sound } : {}),
        ...(shot.transition || objective?.editHint ? { transition: shot.transition || objective?.editHint } : {}),
        ...(shot.continueFromPrevious ? { continueFromPrevious: true } : {}),
      };

      const bodySections = [
        shot.summary,
        buildDialogueBlock(shot.dialogue),
        buildDirectorBlock(objective),
      ].filter((section) => section.length > 0);

      lines.push("", `## ${shot.title}`);
      lines.push("```yaml");
      lines.push(YAML.stringify(shotMeta).trimEnd());
      lines.push("```");
      lines.push(bodySections.join("\n\n"));
    }
  }

  return `${lines.join("\n")}\n`;
}

async function runScriptWriterAgent(
  sourceMode: SourceMode,
  sourceText: string,
  existingScriptPath: string | undefined,
  client: GeminiCreativeLikeClient | undefined,
  artifactPath: string,
): Promise<{ spec: StoryDevelopmentSpec; mode: AgentRun["mode"]; warnings: string[] }> {
  const ingested = existingScriptPath ? await ingestExistingMarkdownScript(existingScriptPath) : undefined;

  if (client) {
    try {
      const generated = await client.generateStructuredOutput<StoryDevelopmentSpec>({
        model: defaultPipelineModel,
        schema: storySpecSchema,
        systemPrompt: buildStoryWriterSystemPrompt(),
        userPrompt: buildStoryWriterUserPrompt(sourceMode, sourceText, ingested),
      });

      const normalized = normalizeStorySpec(generated);
      await writeJson(artifactPath, normalized);
      return {
        spec: normalized,
        mode: "gemini",
        warnings: [],
      };
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      const fallback = buildFallbackStorySpec(sourceText);
      await writeJson(artifactPath, fallback);
      return {
        spec: fallback,
        mode: "fallback",
        warnings: [`Script Writer Agent fell back to local generation: ${warning}`],
      };
    }
  }

  if (ingested) {
    await writeJson(artifactPath, ingested);
    return {
      spec: ingested,
      mode: "ingested",
      warnings: [
        "Script Writer Agent reused the existing markdown script locally without a Chinese rewrite. Run without --dry-run if you want the pipeline to rewrite it into Chinese.",
      ],
    };
  }

  const fallback = buildFallbackStorySpec(sourceText);
  await writeJson(artifactPath, fallback);
  return {
    spec: fallback,
    mode: "fallback",
    warnings: [],
  };
}

async function runScriptReviewAgent(
  spec: StoryDevelopmentSpec,
  client: GeminiCreativeLikeClient | undefined,
  artifactPath: string,
): Promise<{ review: ScriptReviewReport; mode: AgentRun["mode"]; warnings: string[] }> {
  if (client) {
    try {
      const review = await client.generateStructuredOutput<ScriptReviewReport>({
        model: defaultReviewModel,
        schema: reviewSchema,
        systemPrompt: buildReviewSystemPrompt(),
        userPrompt: JSON.stringify(spec, null, 2),
      });

      await writeJson(artifactPath, review);
      return {
        review,
        mode: "gemini",
        warnings: [],
      };
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      const review = buildFallbackReview(spec);
      await writeJson(artifactPath, review);
      return {
        review,
        mode: "fallback",
        warnings: [`Script Review Agent fell back to local review: ${warning}`],
      };
    }
  }

  const review = buildFallbackReview(spec);
  await writeJson(artifactPath, review);
  return {
    review,
    mode: "fallback",
    warnings: [],
  };
}

async function runScriptRevisionAgent(
  spec: StoryDevelopmentSpec,
  review: ScriptReviewReport,
  client: GeminiCreativeLikeClient | undefined,
  artifactPath: string,
): Promise<{ spec: StoryDevelopmentSpec; mode: AgentRun["mode"]; warnings: string[] }> {
  if (client) {
    try {
      const revised = await client.generateStructuredOutput<StoryDevelopmentSpec>({
        model: defaultPipelineModel,
        schema: storySpecSchema,
        systemPrompt: buildScriptRevisionSystemPrompt(),
        userPrompt: buildScriptRevisionUserPrompt(spec, review),
      });

      const normalized = normalizeStorySpec(revised);
      await writeJson(artifactPath, normalized);
      return {
        spec: normalized,
        mode: "gemini",
        warnings: [],
      };
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      await writeJson(artifactPath, spec);
      return {
        spec,
        mode: "fallback",
        warnings: [`Script Revision Agent fell back to the pre-revision spec: ${warning}`],
      };
    }
  }

  await writeJson(artifactPath, spec);
  return {
    spec,
    mode: "fallback",
    warnings: [],
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function generateCharacterReferenceImage(
  client: GeminiCreativeLikeClient,
  spec: StoryDevelopmentSpec,
  character: DevelopmentCharacter,
  prompt: string,
  outputPath: string,
  lineupImagePath: string | undefined,
): Promise<{ imagePath: string; warnings: string[] }> {
  if (lineupImagePath && client.editImage) {
    try {
      return {
        imagePath: await client.editImage({
          model: defaultCharacterEditModel,
          prompt,
          outputPath,
          baseImagePath: lineupImagePath,
          styleImagePath: lineupImagePath,
          styleDescription: spec.style,
          size: "1024x1536",
        }),
        warnings: [],
      };
    } catch (error) {
      const fallbackPrompt = createCharacterImagePrompt(spec, character);
      return {
        imagePath: await client.generateImage({
          model: defaultCharacterImageModel,
          prompt: fallbackPrompt,
          outputPath,
          size: "1024x1536",
        }),
        warnings: [
          `Character Creation Agent could not derive ${character.id} from the cast lineup; fell back to text image generation: ${formatError(error)}`,
        ],
      };
    }
  }

  return {
    imagePath: await client.generateImage({
      model: defaultCharacterImageModel,
      prompt,
      outputPath,
      size: "1024x1536",
    }),
    warnings: [],
  };
}

async function runCharacterCreationAgent(
  spec: StoryDevelopmentSpec,
  refsDir: string,
  client: GeminiCreativeLikeClient | undefined,
  options: CreativePipelineOptions,
  artifactPath: string,
): Promise<{ pack: CharacterPack; mode: AgentRun["mode"]; warnings: string[] }> {
  const warnings: string[] = [];
  const pack: CharacterPack = {
    iteration: 0,
    globalStyleAnchor: spec.style,
    characters: [],
  };

  await ensureDir(refsDir);

  if (client && !options.skipCharacterImages && spec.characters.length > 1) {
    pack.lineupPrompt = createCastLineupPrompt(spec);
    try {
      pack.lineupImagePath = await client.generateImage({
        model: defaultCharacterImageModel,
        prompt: pack.lineupPrompt,
        outputPath: path.join(refsDir, "cast-lineup.png"),
        size: "1536x1024",
      });
    } catch (error) {
      warnings.push(`Character Creation Agent could not generate cast lineup master: ${formatError(error)}`);
    }
  }

  for (const [characterIndex, character] of spec.characters.entries()) {
    const lineupPosition = pack.lineupImagePath ? characterIndex + 1 : undefined;
    const lineupSize = pack.lineupImagePath ? spec.characters.length : undefined;
    const imagePrompt = createCharacterImagePrompt(spec, character, {
      derivedFromLineup: Boolean(pack.lineupImagePath),
      lineupPosition,
      lineupSize,
    });
    const asset: CharacterAsset = {
      id: character.id,
      name: character.name,
      imagePrompt,
      status: "skipped",
      revision: 0,
      lineupPosition,
      lineupSize,
      notes: [
        character.description,
        `Look: ${character.look}`,
        `Wardrobe: ${character.wardrobe}`,
        `Personality hook: ${character.personalityHook}`,
        lineupPosition && lineupSize ? `Cast lineup position: ${lineupPosition} of ${lineupSize} from left to right` : undefined,
        pack.lineupImagePath ? `Cast lineup source: ${pack.lineupImagePath}` : undefined,
      ].filter((note): note is string => Boolean(note)),
    };

    if (client && !options.skipCharacterImages) {
      try {
        const outputPath = path.join(refsDir, `${character.id}.png`);
        const generated = await generateCharacterReferenceImage(
          client,
          spec,
          character,
          imagePrompt,
          outputPath,
          pack.lineupImagePath,
        );
        asset.imagePath = generated.imagePath;
        warnings.push(...generated.warnings);
        asset.status = "generated";
      } catch (error) {
        asset.status = "failed";
        warnings.push(
          `Character Creation Agent could not generate ${character.id}: ${formatError(error)}`,
        );
      }
    }

    pack.characters.push(asset);
  }

  await writeJson(artifactPath, pack);
  return {
    pack,
    mode: client && !options.skipCharacterImages ? "gemini" : "fallback",
    warnings,
  };
}

async function runCharacterEvaluationAgent(
  spec: StoryDevelopmentSpec,
  pack: CharacterPack,
  client: GeminiCreativeLikeClient | undefined,
  artifactPath: string,
): Promise<{ evaluation: CharacterEvaluationReport; mode: AgentRun["mode"]; warnings: string[] }> {
  const generatedImagePaths = getCharacterEvaluationImagePaths(pack);

  if (client && generatedImagePaths.length > 0) {
    try {
      const rawEvaluation = await client.analyzeImages<CharacterEvaluationReport>({
        model: defaultEvaluatorModel,
        schema: characterEvaluationSchema,
        systemPrompt: buildCharacterEvaluationSystemPrompt(),
        userPrompt: buildCharacterEvaluationUserPrompt(spec, pack),
        imagePaths: generatedImagePaths,
      });
      const evaluation = normalizeCharacterEvaluationReport(pack, rawEvaluation);

      await writeJson(artifactPath, evaluation);
      return {
        evaluation,
        mode: "gemini",
        warnings: [],
      };
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      const fallback = buildFallbackCharacterEvaluation(spec, pack);
      await writeJson(artifactPath, fallback);
      return {
        evaluation: fallback,
        mode: "fallback",
        warnings: [`Character Evaluation Agent fell back to local review: ${warning}`],
      };
    }
  }

  const fallback = buildFallbackCharacterEvaluation(spec, pack);
  await writeJson(artifactPath, fallback);
  return {
    evaluation: fallback,
    mode: "fallback",
    warnings: [],
  };
}

async function rerunCharacterCreationAgent(
  spec: StoryDevelopmentSpec,
  currentPack: CharacterPack,
  evaluation: CharacterEvaluationReport,
  refsDir: string,
  client: GeminiCreativeLikeClient,
  artifactPath: string,
): Promise<{ pack: CharacterPack; mode: AgentRun["mode"]; warnings: string[] }> {
  const warnings: string[] = [];
  const notesById = new Map(evaluation.characters.map((character) => [character.id, character]));
  const specCharactersById = new Map(spec.characters.map((character) => [character.id, character]));
  const styleMasterAsset = selectStyleMasterAsset(currentPack, evaluation);

  const nextPack: CharacterPack = {
    iteration: currentPack.iteration + 1,
    globalStyleAnchor: currentPack.globalStyleAnchor,
    lineupPrompt: currentPack.lineupPrompt,
    lineupImagePath: currentPack.lineupImagePath,
    characters: [],
  };

  for (const existingAsset of currentPack.characters) {
    const sourceCharacter = specCharactersById.get(existingAsset.id);
    if (!sourceCharacter || !existingAsset.imagePath) {
      nextPack.characters.push(existingAsset);
      continue;
    }

    const evaluationNote = notesById.get(existingAsset.id);
    if (!shouldRegenerateCharacter(evaluationNote)) {
      nextPack.characters.push(existingAsset);
      continue;
    }

    const nextRevision = existingAsset.revision + 1;
    const revisedPrompt = buildCharacterRevisionPrompt(
      spec,
      sourceCharacter,
      evaluationNote,
      evaluation.recommendedGlobalAdjustments,
      nextRevision,
    );

    const revisedAsset: CharacterAsset = {
      ...existingAsset,
      revision: nextRevision,
      imagePrompt: revisedPrompt,
      notes: [
        ...existingAsset.notes,
        `Revision ${nextRevision}: ${(evaluationNote?.refinementAdvice ?? evaluation.recommendedGlobalAdjustments).join(" | ") || "tighten style consistency"}`,
      ],
    };

    try {
      const outputPath = path.join(refsDir, `${existingAsset.id}-rev-${nextRevision}.png`);
      const revisionStyleImagePath = selectRevisionStyleImagePath(currentPack, styleMasterAsset, existingAsset);
      if (client.editImage && revisionStyleImagePath) {
        revisedAsset.imagePath = await client.editImage({
          model: defaultCharacterEditModel,
          prompt: revisedPrompt,
          outputPath,
          baseImagePath: existingAsset.imagePath,
          styleImagePath: revisionStyleImagePath,
          styleDescription: spec.style,
          size: "1024x1536",
        });
      } else {
        revisedAsset.imagePath = await client.generateImage({
          model: defaultCharacterImageModel,
          prompt: revisedPrompt,
          outputPath,
          size: "1024x1536",
        });
      }
      revisedAsset.status = "generated";
    } catch (error) {
      revisedAsset.status = "failed";
      warnings.push(
        `Character Creation Agent revision ${nextRevision} failed for ${existingAsset.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    nextPack.characters.push(revisedAsset);
  }

  await writeJson(artifactPath, nextPack);
  return {
    pack: nextPack,
    mode: "gemini",
    warnings,
  };
}

async function runDirectorAgent(
  spec: StoryDevelopmentSpec,
  review: ScriptReviewReport,
  evaluation: CharacterEvaluationReport,
  client: GeminiCreativeLikeClient | undefined,
  artifactPath: string,
): Promise<{ director: DirectorReport; mode: AgentRun["mode"]; warnings: string[] }> {
  if (client) {
    try {
      const director = await client.generateStructuredOutput<DirectorReport>({
        model: defaultDirectorModel,
        schema: directorSchema,
        systemPrompt: buildDirectorSystemPrompt(),
        userPrompt: buildDirectorUserPrompt(spec, review, evaluation),
      });

      await writeJson(artifactPath, director);
      return {
        director,
        mode: "gemini",
        warnings: [],
      };
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      const director = buildFallbackDirectorReport(spec);
      await writeJson(artifactPath, director);
      return {
        director,
        mode: "fallback",
        warnings: [`Director Agent fell back to local guidance: ${warning}`],
      };
    }
  }

  const director = buildFallbackDirectorReport(spec);
  await writeJson(artifactPath, director);
  return {
    director,
    mode: "fallback",
    warnings: [],
  };
}

export async function runCreativePipeline(options: CreativePipelineOptions): Promise<CreativePipelineResult> {
  const { sourceMode, sourceText, existingScriptPath } = await resolvePipelineInput(options);
  const runDir = choosePipelineRunDir(sourceText, options.outputDir);
  const developmentDir = path.join(runDir, "development");
  const refsDir = path.join(developmentDir, "refs");
  const renderDir = path.join(runDir, "render");
  const finalScriptPath = path.join(developmentDir, "final-script.md");
  const shouldRender = options.render === true && options.skipRender !== true;

  await ensureDir(developmentDir);
  await ensureDir(refsDir);

  const warnings: string[] = [];
  const agentRuns: AgentRun[] = [];
  const characterConsistencyThreshold = clampConsistencyThreshold(options.characterConsistencyThreshold);
  const maxCharacterRefinementRounds = clampRefinementRounds(options.maxCharacterRefinementRounds);

  const intakeArtifactPath = path.join(developmentDir, "00-intake.json");
  await writeJson(intakeArtifactPath, {
    sourceMode,
    sourceText,
    existingScriptPath,
  });

  const geminiApiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const geminiCreativeClient = options.geminiCreativeClient ??
    (options.dryRun || !geminiApiKey
      ? undefined
      : new GeminiCreativeClient(geminiApiKey));

  const writerArtifactPath = path.join(developmentDir, "01-script-writer.json");
  const writerResult = await runScriptWriterAgent(
    sourceMode,
    sourceText,
    existingScriptPath,
    geminiCreativeClient,
    writerArtifactPath,
  );
  warnings.push(...writerResult.warnings);
  agentRuns.push({
    name: "script-writer",
    mode: writerResult.mode,
    artifactPath: writerArtifactPath,
    warnings: writerResult.warnings,
  });
  let workingSpec = writerResult.spec;

  const reviewArtifactPath = path.join(developmentDir, "02-script-review.json");
  const reviewResult = await runScriptReviewAgent(workingSpec, geminiCreativeClient, reviewArtifactPath);
  warnings.push(...reviewResult.warnings);
  agentRuns.push({
    name: "script-review",
    mode: reviewResult.mode,
    artifactPath: reviewArtifactPath,
    warnings: reviewResult.warnings,
  });

  if (shouldReviseScript(reviewResult.review)) {
    const revisionArtifactPath = path.join(developmentDir, "02b-script-revision.json");
    const revisionResult = await runScriptRevisionAgent(
      workingSpec,
      reviewResult.review,
      geminiCreativeClient,
      revisionArtifactPath,
    );
    warnings.push(...revisionResult.warnings);
    agentRuns.push({
      name: "script-revision",
      mode: revisionResult.mode,
      artifactPath: revisionArtifactPath,
      warnings: revisionResult.warnings,
    });
    workingSpec = revisionResult.spec;
  }

  const characterArtifactPath = path.join(developmentDir, "03-character-pack.json");
  const characterResult = await runCharacterCreationAgent(
    workingSpec,
    refsDir,
    geminiCreativeClient,
    options,
    characterArtifactPath,
  );
  warnings.push(...characterResult.warnings);
  agentRuns.push({
    name: "character-creation",
    mode: characterResult.mode,
    artifactPath: characterArtifactPath,
    warnings: characterResult.warnings,
  });

  let characterPack = characterResult.pack;

  const evaluationArtifactPath = path.join(developmentDir, "04-character-evaluation.json");
  let evaluationResult = await runCharacterEvaluationAgent(
    workingSpec,
    characterPack,
    geminiCreativeClient,
    evaluationArtifactPath,
  );
  warnings.push(...evaluationResult.warnings);
  agentRuns.push({
    name: "character-evaluation",
    mode: evaluationResult.mode,
    artifactPath: evaluationArtifactPath,
    warnings: evaluationResult.warnings,
  });

  let remainingRefinementRounds = maxCharacterRefinementRounds;
  while (
    shouldRegenerateCharacters(
      characterPack,
      evaluationResult.evaluation,
      characterConsistencyThreshold,
      remainingRefinementRounds,
      geminiCreativeClient,
      options,
    )
  ) {
    const nextRevision = characterPack.iteration + 1;
    const refinementCharacterArtifactPath = path.join(
      developmentDir,
      `03-character-pack.revision-${nextRevision}.json`,
    );
    const refinementCharacterResult = await rerunCharacterCreationAgent(
      workingSpec,
      characterPack,
      evaluationResult.evaluation,
      refsDir,
      geminiCreativeClient as GeminiCreativeLikeClient,
      refinementCharacterArtifactPath,
    );
    warnings.push(...refinementCharacterResult.warnings);
    agentRuns.push({
      name: `character-creation-revision-${nextRevision}`,
      mode: refinementCharacterResult.mode,
      artifactPath: refinementCharacterArtifactPath,
      warnings: refinementCharacterResult.warnings,
    });
    characterPack = refinementCharacterResult.pack;

    const refinementEvaluationArtifactPath = path.join(
      developmentDir,
      `04-character-evaluation.revision-${nextRevision}.json`,
    );
    evaluationResult = await runCharacterEvaluationAgent(
      workingSpec,
      characterPack,
      geminiCreativeClient,
      refinementEvaluationArtifactPath,
    );
    warnings.push(...evaluationResult.warnings);
    agentRuns.push({
      name: `character-evaluation-revision-${nextRevision}`,
      mode: evaluationResult.mode,
      artifactPath: refinementEvaluationArtifactPath,
      warnings: evaluationResult.warnings,
    });

    remainingRefinementRounds -= 1;
  }

  const directorArtifactPath = path.join(developmentDir, "05-director-report.json");
  const directorResult = await runDirectorAgent(
    workingSpec,
    reviewResult.review,
    evaluationResult.evaluation,
    geminiCreativeClient,
    directorArtifactPath,
  );
  warnings.push(...directorResult.warnings);
  agentRuns.push({
    name: "director",
    mode: directorResult.mode,
    artifactPath: directorArtifactPath,
    warnings: directorResult.warnings,
  });

  const finalScript = renderSpecToMarkdown(
    workingSpec,
    directorResult.director,
    characterPack,
    finalScriptPath,
    options.modelOverride,
  );
  await fs.writeFile(finalScriptPath, finalScript, "utf8");

  let manifest: RenderManifest | undefined;
  let renderManifestPath: string | undefined;
  if (shouldRender) {
    manifest = await renderProject({
      scriptPath: finalScriptPath,
      outputDir: renderDir,
      apiKey: options.apiKey,
      modelOverride: options.modelOverride,
      dryRun: options.dryRun,
      pollMs: options.pollMs,
      interShotDelayMs: options.interShotDelayMs,
    });
    renderManifestPath = path.join(renderDir, "manifest.json");
  }

  const pipelineSummaryPath = path.join(developmentDir, "pipeline-summary.json");
  await writeJson(pipelineSummaryPath, {
    sourceMode,
    finalScriptPath,
    renderRequested: shouldRender,
    renderManifestPath,
    nextRenderCommand: `npm run render -- --script "${relativeToCwd(finalScriptPath)}"`,
    warnings,
    agentRuns,
    characterConsistencyThreshold,
    maxCharacterRefinementRounds,
    finalCharacterConsistencyScore: evaluationResult.evaluation.styleConsistencyScore,
  });

  return {
    runDir,
    developmentDir,
    refsDir,
    finalScriptPath,
    renderRequested: shouldRender,
    renderManifest: manifest,
    renderManifestPath,
    finalVideoPath: manifest?.finalVideoPath,
    sourceMode,
    warnings,
    agentRuns,
    finalCharacterConsistencyScore: evaluationResult.evaluation.styleConsistencyScore,
    characterRefinementRoundsApplied: characterPack.iteration,
  };
}

export function summarizeCreativePipeline(result: CreativePipelineResult): string {
  const lines = [
    "Creative pipeline complete",
    `Source mode: ${result.sourceMode}`,
    `Run dir: ${relativeToCwd(result.runDir)}`,
    `Development dir: ${relativeToCwd(result.developmentDir)}`,
    `Final script: ${relativeToCwd(result.finalScriptPath)}`,
  ];

  if (result.renderRequested && result.renderManifestPath) {
    lines.push(`Manifest: ${relativeToCwd(result.renderManifestPath)}`);
  } else {
    lines.push("Render stage: not started (review the final script first)");
    lines.push(`Next step: npm run render -- --script "${relativeToCwd(result.finalScriptPath)}"`);
  }

  if (result.finalVideoPath) {
    lines.push(`Final video: ${relativeToCwd(result.finalVideoPath)}`);
  }

  if (typeof result.finalCharacterConsistencyScore === "number") {
    lines.push(`Character consistency score: ${result.finalCharacterConsistencyScore}`);
    lines.push(`Character refinement rounds: ${result.characterRefinementRoundsApplied}`);
  }

  for (const agentRun of result.agentRuns) {
    lines.push(
      `- ${agentRun.name}: ${agentRun.mode} (${relativeToCwd(agentRun.artifactPath)})`,
    );
    for (const warning of agentRun.warnings) {
      lines.push(`  warning: ${warning}`);
    }
  }

  for (const warning of result.warnings) {
    lines.push(`warning: ${warning}`);
  }

  return lines.join("\n");
}
