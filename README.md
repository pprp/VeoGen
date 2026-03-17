# VeoGen

`VeoGen` is a Markdown-first Gemini Veo orchestration scaffold for short-form videos up to 120 seconds.

It is designed for this workflow:
- author the script in `.md`
- keep a small character bible in frontmatter
- add optional reference images for characters, shots, or overall style
- generate multiple Veo clips under a shared consistency prompt
- stitch the finished clips into one short video with `ffmpeg`

## Why this shape

The current Gemini video API page for Veo generation states a few constraints that directly affect project design:
- a single generated clip is not enough for a 2-minute short, so the project must schedule multiple clips
- reference-image generation is limited to at most 3 images per request
- `1080p` and reference-image requests require 8-second clips
- video extension and reference images cannot be used together in the same request

Those rules are enforced during planning and written into `plan.json` / `manifest.json` warnings.

Source used for the scaffold:
- Gemini video generation docs: <https://ai.google.dev/gemini-api/docs/video?example=dialogue>

## Install

```bash
npm install --cache .npm-cache
```

Set your API key:

```bash
export GEMINI_API_KEY=your_key_here
```

## Markdown contract

The file format is:

1. YAML frontmatter for project-wide settings and character definitions
2. `# Scene Title` for scenes
3. `## Shot Title` for each renderable clip
4. an optional leading fenced `yaml` block inside each shot for structured shot metadata
5. free-form markdown below the YAML block for action, dialogue, and staging notes

Example:

````md
---
title: My Short Film
aspectRatio: "16:9"
resolution: "720p"
maxDurationSec: 120
characters:
  - id: hero
    name: Hero
    description: focused young woman with short silver hair
    referenceImages:
      - refs/hero.jpg
---
# Scene 1
Scene setup text.

## Shot 1
```yaml
durationSec: 8
characters: [hero]
camera: slow push-in
references:
  - refs/room.jpg
```
Hero opens the door and finally steps inside.
````

## Commands

Build a plan without calling the API:

```bash
npm run plan -- --script examples/demo-short.md
```

Dry-run a full render job and write prompts/manifests to disk:

```bash
npm run render -- --script examples/demo-short.md --dry-run
```

Render clips with Gemini and stitch them:

```bash
npm run render -- --script examples/demo-short.md
```

Restitch an existing run:

```bash
npm run dev -- stitch --manifest outputs/<run-id>/manifest.json
```

## Output layout

Each render run gets its own folder:

```text
outputs/<run-id>/
  clips/
  prompts/
  plan.json
  manifest.json
  final-video.mp4
```

`plan.json` is the normalized, preflighted intent.

`manifest.json` is the execution record, including per-shot statuses, remote URIs, and the final stitched output path.

## Notes

- The planner prioritizes active character references first, then uses one optional style reference if space remains within the 3-image limit.
- If a shot sets `continueFromPrevious: true`, VeoGen switches that shot into video-extension mode and drops reference images for that request because the Gemini API does not support both together.
- The scaffold is intentionally backend-first. It gives you a stable orchestration core before adding UI, queueing, asset management, voiceover, or subtitle workflows.
