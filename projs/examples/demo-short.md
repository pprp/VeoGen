---
title: Neon Run
synopsis: Two estranged siblings reunite on a rain-soaked rooftop to recover a stolen memory drive before dawn.
model: veo-3.0-generate-preview
aspectRatio: "16:9"
resolution: "720p"
maxDurationSec: 120
defaultClipDurationSec: 8
generateAudio: true
enhancePrompt: true
personGeneration: allow_adult
style: grounded cyberpunk thriller, practical lighting, moody rain atmosphere, realistic motion, production sound
negativePrompt: extra fingers, warped faces, duplicate people, broken anatomy, flicker, subtitles, watermarks
outputDir: outputs
seed: 4242
characters:
  - id: maya
    name: Maya
    description: late-20s East Asian woman, sharp eyes, wet black bob haircut, composed but exhausted
    wardrobe: matte black raincoat over charcoal tactical clothing
    voice: calm low register
    mannerisms: controlled breathing, minimal gestures, sustained eye contact
    referenceImages:
      - refs/maya-portrait.jpg
  - id: ren
    name: Ren
    description: early-30s East Asian man, lean build, tired expression, undercut hairstyle
    wardrobe: dark bomber jacket with reflective piping
    voice: restrained baritone
    mannerisms: restless hands, wary half-turns, avoids direct eye contact
    referenceImages:
      - refs/ren-portrait.jpg
styleReferenceImages:
  - refs/style-board.jpg
---
# Scene 1: Rooftop Reunion
Cold rain cuts across a dense neon skyline. The siblings arrive from opposite sides of the rooftop, both unsure whether the other can still be trusted.

## Shot 1: Establishing the rooftop
```yaml
durationSec: 8
characters: [maya]
location: rain-soaked corporate rooftop with dense neon skyline
timeOfDay: pre-dawn
camera: wide anamorphic establishing shot
movement: slow crane downward into Maya's entrance
mood: tense and lonely
sound: rain, distant traffic, low electrical hum
references:
  - refs/rooftop-wide.jpg
```
Maya steps through a flickering maintenance door and scans the rooftop, one hand protecting a small metal case under her coat.

## Shot 2: Ren appears
```yaml
durationSec: 8
characters: [maya, ren]
location: same rooftop, near the helipad markings
camera: medium two-shot with shallow depth of field
movement: handheld push-in as Ren emerges from shadow
mood: distrust with buried affection
sound: rain on metal, footsteps, coat fabric movement
references:
  - refs/helipad-detail.jpg
```
Ren steps out from behind a ventilation unit.

Maya: You took your time.
Ren: I had to make sure we weren't followed.

## Shot 3: The handoff almost fails
```yaml
durationSec: 8
characters: [maya, ren]
location: rooftop centerline
camera: close alternating over-the-shoulder coverage
movement: tighten slowly as the case changes hands
mood: fragile trust
sound: rain intensifies, breath, distant siren
continueFromPrevious: true
```
Maya offers the case. Ren reaches for it, hesitates, and looks past her toward the access door as if he heard something below.
