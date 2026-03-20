# VeoGen

[中文说明](./README.zh-CN.md)

VeoGen is a Markdown-first Gemini Veo orchestration scaffold for short videos up to 120 seconds. It turns a script into a validated render plan, per-shot prompt files, generated clips, and an optional stitched final video.

Status: experimental `v0.1`. The repository is meant to be run from source and is not currently published as an npm package.

## What It Does

- Write scenes and shots in Markdown instead of hard-coding requests.
- Store project settings and character definitions in YAML frontmatter.
- Attach character, shot, and style reference images.
- Preflight current Gemini video API constraints before a render starts.
- Dry-run the full workflow without calling the API.
- Re-render only selected shots with `--shot`.
- Persist `plan.json` and `manifest.json` for debugging, recovery, and restitching.

## Why This Repo Exists

VeoGen is not a one-prompt demo. It is a small orchestration layer for short-form video projects where a single request is not enough.

The current Gemini video workflow imposes a few rules that directly shape this project:

- a short film usually needs multiple clips instead of one long generation
- a single request supports at most 3 reference images
- `1080p` requests and reference-image requests require 8-second clips
- video extension requests cannot use reference images at the same time

VeoGen checks those constraints during planning and records warnings in `plan.json` and `manifest.json`.

Source reference: [Gemini video generation docs](https://ai.google.dev/gemini-api/docs/video?example=dialogue)

## Requirements

- Node.js `>=20`
- `ffmpeg` on your `PATH` if you want stitched output videos
- `GEMINI_API_KEY` with access to Gemini video generation models
- A local clone of this repository

## Quick Start

```bash
git clone <repo-url>
cd VeoGen
npm install --cache .npm-cache

export GEMINI_API_KEY=your_key_here

npm run plan -- --script projs/examples/demo-short.md
npm run render -- --script projs/examples/demo-short.md --dry-run
```

If the dry run looks correct, do a real render:

```bash
npm run render -- --script projs/examples/demo-short.md
```

If you prefer a local `.env` file, `run.sh` loads it automatically:

```bash
echo 'GEMINI_API_KEY=your_key_here' > .env
bash run.sh dry-run projs/examples/demo-short.md
```

Start with [`projs/examples/demo-short.md`](./projs/examples/demo-short.md) if you want the smallest working script.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run plan -- --script projs/examples/demo-short.md` | Parse the script and build a render plan without calling Gemini |
| `npm run render -- --script projs/examples/demo-short.md --dry-run` | Build prompts, plan, and manifest without API calls |
| `npm run render -- --script projs/examples/demo-short.md` | Generate clips and stitch them |
| `npm run render -- --script projs/examples/demo-short.md --shot 2 --shot scene-03-shot-01` | Re-run only selected shots |
| `npm run render -- --script projs/examples/demo-short.md --skip-stitch` | Generate clips but skip `ffmpeg` stitching |
| `npm run dev -- stitch --manifest outputs/<run-id>/manifest.json` | Stitch completed clips from an existing manifest |
| `npm run typecheck` | Run TypeScript type checking |

## Shortcut Wrapper

`run.sh` wraps the most common workflows and resolves project directories under `projs/`:

```bash
bash run.sh
bash run.sh fast
bash run.sh plan projs/examples/demo-short.md
bash run.sh render drawio-proj --shot last
bash run.sh stitch --manifest outputs/some-run/manifest.json
```

`bash run.sh fast` uses `veo-3.1-fast-generate-preview` unless you override `--model`.

## Project Layout

```text
src/                         core parser, planner, prompt builder, Gemini client, stitcher
projs/examples/              minimal sample project
projs/Fitness-proj/          larger sample project
projs/drawio-proj/           reference-heavy sample project
outputs/                     generated plans, prompts, clips, manifests, final videos
run.sh                       convenience wrapper around the CLI
```

## Script Format

Each script uses:

1. YAML frontmatter for project-wide config and characters
2. `# Scene Title` headings for scenes
3. `## Shot Title` headings for renderable shots
4. an optional fenced `yaml` block inside each shot for structured shot metadata
5. free-form Markdown below the YAML block for action, dialogue, and staging notes

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

## Frontmatter Reference

| Key | Meaning |
| --- | --- |
| `title` | Project title used in logs and output directory naming |
| `synopsis` | Optional project summary |
| `model` | Gemini video model name, defaulting to `veo-3.0-generate-preview` unless `VEO_MODEL` is set |
| `aspectRatio` | `16:9` or `9:16` |
| `resolution` | `720p` or `1080p` |
| `maxDurationSec` | Total planned duration cap, max `120` |
| `defaultClipDurationSec` | Default shot duration, max `8` |
| `generateAudio` | Whether generated clips should include audio |
| `enhancePrompt` | Whether prompt enhancement should be enabled |
| `personGeneration` | `allow_adult`, `dont_allow`, or `allow_all` |
| `negativePrompt` | Optional negative prompt applied to shots |
| `style` | Optional global style text |
| `styleReferenceImages` | Optional project-level style references |
| `outputDir` | Base output directory, default `outputs` |
| `seed` | Optional project seed |
| `characters` | Array of character definitions, including optional `referenceImages` |

Note: `generateAudio`, `enhancePrompt`, `negativePrompt`, and `seed` are already part of the script schema and are preserved in plan output, but the current Gemini request adapter does not apply all of them end-to-end yet.

## Shot YAML Reference

| Key | Meaning |
| --- | --- |
| `durationSec` | Shot duration in seconds, max `8` |
| `characters` | Character ids active in the shot |
| `location` | Optional location note |
| `timeOfDay` | Optional time-of-day note |
| `camera` | Camera framing or lens instruction |
| `movement` | Camera or subject movement |
| `mood` | Emotional tone |
| `sound` | Sound or dialogue note |
| `references` | Shot-level reference image paths |
| `continueFromPrevious` | Extend the previous generated clip instead of starting from text only |
| `transition` | Optional transition note |
| `seedOffset` | Per-shot seed adjustment |

## Output Files

Each run gets its own output folder:

```text
outputs/<run-id>/
  clips/
  prompts/
  plan.json
  manifest.json
  final-video.mp4
```

- `plan.json` is the normalized, validated plan.
- `manifest.json` is the execution record with per-shot statuses, remote URIs, and final output info.
- `prompts/` stores the final prompt text sent per shot.
- `clips/` stores downloaded clip files.
- `final-video.mp4` is written only when stitching succeeds and is not skipped.

## Important Behavior

- Reference image selection is budgeted. Active character and shot references are chosen first, then one optional style reference if there is still room within the 3-image limit.
- `1080p` requests and requests with reference images are forced to 8-second clips during planning.
- If a shot sets `continueFromPrevious: true`, VeoGen switches that shot into video-extension mode and removes reference images for that request.
- `--shot` accepts a global shot index, a shot id, or `last`.
- If you select a shot that depends on `continueFromPrevious`, its previous shot must be rendered in the same run.
- Final stitching uses `ffmpeg`, first via stream copy and then with a re-encode fallback if needed.

## Scope

This repository is intentionally backend-first. It focuses on the orchestration core:

- script parsing
- plan validation
- prompt materialization
- Gemini clip generation
- manifest persistence
- final stitching

It does not yet include a UI, queueing system, asset management layer, subtitle workflow, or voiceover pipeline.
