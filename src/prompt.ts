import type { Character, ParsedScene, ParsedShot, ProjectConfig, ReferenceType } from "./types.js";

function formatCharacter(character: Character): string {
  const traits = [
    `name: ${character.name}`,
    `description: ${character.description}`,
    character.look ? `look: ${character.look}` : undefined,
    character.wardrobe ? `wardrobe: ${character.wardrobe}` : undefined,
    character.voice ? `voice: ${character.voice}` : undefined,
    character.mannerisms ? `mannerisms: ${character.mannerisms}` : undefined,
  ].filter(Boolean);

  return `- ${character.id}: ${traits.join("; ")}`;
}

function normalizeSpeakerName(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function extractDialogueFromBody(body: string, speakers: Character[]): {
  visualBody: string;
  dialogueLines: string[];
} {
  const dialogueLines: string[] = [];
  const visualLines: string[] = [];
  const allowedSpeakers = new Set(
    speakers.flatMap((speaker) => {
      return [
        normalizeSpeakerName(speaker.id),
        normalizeSpeakerName(speaker.name),
      ];
    }),
  );

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*([\p{L}\p{N}_ .'-]{1,48}):\s*(.+)$/u);
    if (match && allowedSpeakers.has(normalizeSpeakerName(match[1]))) {
      dialogueLines.push(match[2].trim());
    } else {
      visualLines.push(line);
    }
  }

  return {
    visualBody: visualLines.join("\n").trim(),
    dialogueLines,
  };
}

export function buildShotPrompt(input: {
  project: ProjectConfig;
  scene: ParsedScene;
  shot: ParsedShot;
  previousShot?: ParsedShot;
  hasReferenceImages?: boolean;
  selectedReferences?: Array<{
    sourceLabel: string;
    sourcePath: string;
    referenceType: ReferenceType;
  }>;
}): string {
  const { project, scene, shot, previousShot, hasReferenceImages, selectedReferences = [] } = input;
  const activeCharacters = project.characters.filter((character) =>
    shot.meta.characters.includes(character.id),
  );
  const shotText = extractDialogueFromBody(shot.body ?? "", activeCharacters);
  const referenceMapping = selectedReferences.length > 0
    ? [
        "Attached reference image mapping, in attachment order:",
        ...selectedReferences.map((reference, index) => {
          return `- image ${index + 1}: ${reference.sourceLabel}; type=${reference.referenceType}; path=${reference.sourcePath}`;
        }),
        "Bind each active character to their matching `character:<id>` reference image. Background, profile, partial, and side-view appearances must still preserve that character's exact reference face, hairstyle, body proportions, and wardrobe construction.",
      ].join("\n")
    : undefined;

  const sections = [
    "Generate one cinematic video clip for a larger short film.",
    "Keep recurring characters, wardrobe, face shape, hair, age, props, and voice consistent across all clips unless the script explicitly changes them.",
    [
      "Style lock:",
      "- choose one single visual family and keep it locked for the whole short film",
      "- do not alternate between photoreal live-action, anime, cel-shaded cartoon, painterly illustration, comic-book art, or stylized 3D looks",
      "- keep the same facial proportion system, shading language, texture density, line treatment, and lighting behavior across every shot",
      "- if one shot starts drifting into a different rendering style, pull it back to the same shared look as the rest of the film",
    ].join("\n"),
    activeCharacters.length > 0
      ? [
          "Identity lock:",
          "- treat the active characters as the exact same recurring individuals across every clip",
          "- preserve exact facial proportions, eye shape, hairstyle, body silhouette, skin tone, wardrobe construction, and all unique markings or props",
          "- preserve the exact uniform cut, collar type, jacket shape, sleeve treatment, school badge placement, and shirt layering from each character reference",
          "- do not swap a blazer for a vest, standing-collar jacket, tracksuit, or different school uniform style",
          "- apply the same identity lock to background, profile, cropped, or partially visible characters",
          "- do not add new eyebrows, scars, markings, clothing, or accessories unless the script explicitly requests them",
          "- if the story calls for fatigue, fitness, or body-condition changes, only change those state attributes while keeping the same identity",
        ].join("\n")
      : undefined,
    hasReferenceImages
      ? "Attached reference images are hard identity constraints. Match them closely for character design, proportions, markings, and silhouette. Use them as fidelity targets, not loose inspiration."
      : undefined,
    referenceMapping,
    project.synopsis ? `Project synopsis: ${project.synopsis}` : undefined,
    project.style ? `Global style direction: ${project.style}` : undefined,
    activeCharacters.length > 0
      ? `Character continuity:\n${activeCharacters.map(formatCharacter).join("\n")}`
      : undefined,
    `Scene title: ${scene.title}`,
    scene.synopsis ? `Scene setup: ${scene.synopsis}` : undefined,
    `Shot title: ${shot.title}`,
    shot.meta.location ? `Location: ${shot.meta.location}` : undefined,
    shot.meta.timeOfDay ? `Time of day: ${shot.meta.timeOfDay}` : undefined,
    shot.meta.camera ? `Camera: ${shot.meta.camera}` : undefined,
    shot.meta.movement ? `Movement: ${shot.meta.movement}` : undefined,
    shot.meta.mood ? `Mood: ${shot.meta.mood}` : undefined,
    shot.meta.sound ? `Sound bed: ${shot.meta.sound}` : undefined,
    shot.meta.transition ? `Transition intent: ${shot.meta.transition}` : undefined,
    shot.meta.continueFromPrevious && previousShot
      ? `Continue directly from the end of Shot ${previousShot.globalIndex}. Preserve screen direction, blocking, lighting, set dressing, and ambient audio.`
      : undefined,
    shotText.visualBody ? `Shot script:\n${shotText.visualBody}` : undefined,
    shotText.dialogueLines.length > 0
      ? [
          "Spoken dialogue for audio and lip movement only:",
          ...shotText.dialogueLines.map((line) => `- ${line}`),
          "Do not render these words, speaker names, subtitles, captions, or lower-third labels on screen.",
        ].join("\n")
      : undefined,
    [
      "Output requirements:",
      "- natural body motion and stable anatomy",
      "- coherent lip sync when dialogue is present",
      "- spoken dialogue must appear only as voice and mouth movement; never render subtitles, captions, transcript text, karaoke text, lower-third text, or burned-in dialogue words",
      "- maintain location continuity and prop continuity",
      "- avoid introducing extra characters or wardrobe changes not in the script",
      "- avoid readable text of any kind; prefer abstract icons, glyphs, and clean non-lexical interface shapes when visual marks are needed",
      "- preserve the intended emotional tone",
    ].join("\n"),
  ].filter(Boolean);

  return sections.join("\n\n");
}
