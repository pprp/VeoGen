import type { Character, ParsedScene, ParsedShot, ProjectConfig } from "./types.js";

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

export function buildShotPrompt(input: {
  project: ProjectConfig;
  scene: ParsedScene;
  shot: ParsedShot;
  previousShot?: ParsedShot;
  hasReferenceImages?: boolean;
}): string {
  const { project, scene, shot, previousShot, hasReferenceImages } = input;
  const activeCharacters = project.characters.filter((character) =>
    shot.meta.characters.includes(character.id),
  );

  const sections = [
    "Generate one cinematic video clip for a larger short film.",
    "Keep recurring characters, wardrobe, face shape, hair, age, props, and voice consistent across all clips unless the script explicitly changes them.",
    activeCharacters.length > 0
      ? [
          "Identity lock:",
          "- treat the active characters as the exact same recurring individuals across every clip",
          "- preserve exact facial proportions, eye shape, antenna count and length, claw asymmetry, shell segmentation, body silhouette, and all unique markings",
          "- do not add new eyebrows, scars, markings, clothing, or accessories unless the script explicitly requests them",
          "- if the story calls for fatigue, fitness, or body-condition changes, only change those state attributes while keeping the same identity",
        ].join("\n")
      : undefined,
    hasReferenceImages
      ? "Attached reference images are hard identity constraints. Match them closely for character design, proportions, markings, and silhouette. Use them as fidelity targets, not loose inspiration."
      : undefined,
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
    shot.body ? `Shot script:\n${shot.body}` : undefined,
    [
      "Output requirements:",
      "- natural body motion and stable anatomy",
      "- coherent lip sync when dialogue is present",
      "- maintain location continuity and prop continuity",
      "- avoid introducing extra characters or wardrobe changes not in the script",
      "- avoid readable UI text; prefer abstract icons, glyphs, and clean non-lexical interface shapes",
      "- preserve the intended emotional tone",
    ].join("\n"),
  ].filter(Boolean);

  return sections.join("\n\n");
}
