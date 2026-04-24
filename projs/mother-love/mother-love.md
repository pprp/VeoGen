---
title: Receipt Box
synopsis: A daughter thinks her mother missed every important moment. On the night before leaving home, she discovers those absences were all hidden acts of love.
aspectRatio: "9:16"
resolution: "720p"
maxDurationSec: 64
defaultClipDurationSec: 8
generateAudio: true
enhancePrompt: true
personGeneration: allow_adult
style: cinematic vertical realism, late-night convenience store, restrained emotion, rain-streaked glass, practical fluorescent light mixed with warm counter light, subtle handheld intimacy, natural skin texture, no melodrama
styleReferenceImages:
  - refs/mother-love-store-reference.png
negativePrompt: subtitles, captions, readable text, logos, brand names, watermarks, extra fingers, warped hands, distorted faces, overacting, fantasy elements, anime styling
outputDir: outputs
seed: 4217
characters:
  - id: mother
    name: Mother
    description: late-40s East Asian single mother, tired face, gentle eyes, practical short hair, restrained tenderness beneath exhaustion
    wardrobe: simple late-night convenience-store uniform, plain apron, worn cardigan under the uniform
    voice: quiet low register, careful with emotion
    mannerisms: folds paper slowly, hides fatigue with small precise movements, looks down before admitting love
    referenceImages:
      - refs/mother-love-store-reference.png
  - id: daughter
    name: Daughter
    description: 18-year-old East Asian daughter, guarded expression, leaving home for school, hurt by years of misunderstood absence
    wardrobe: travel hoodie, canvas backpack, simple pendant from childhood
    voice: controlled but close to breaking
    mannerisms: clenches backpack straps, avoids eye contact, then softens
---
# Scene 1: The Night Before Leaving
Rain slides down the convenience-store window at 4:48 a.m. The daughter comes to confront her mother before leaving the city.

## Shot 1: Hook - the accusation
```yaml
durationSec: 8
characters: [daughter, mother]
location: convenience-store aisle near the counter, rain outside the glass
timeOfDay: pre-dawn
camera: vertical handheld close two-shot, daughter foreground, mother blurred behind counter
movement: sudden push-in as the daughter drops her backpack
mood: wounded, tense, immediately emotional
sound: rain, refrigerator hum, backpack hitting floor
```
The daughter stares at her mother and says the line she has rehearsed for years.

Daughter: Tomorrow I leave. You can miss that too.

## Shot 2: Mother hides the box
```yaml
durationSec: 8
characters: [mother]
location: behind the counter
camera: tight close-up on the mother's hands and face
movement: slow tilt from a half-hidden gift box to her tired eyes
mood: secretive tenderness under pressure
sound: paper rustle, scanner beep in the distance
references:
  - refs/mother-love-store-reference.png
```
The mother quietly slides a small handmade box under the counter. Inside are folded old receipts, but their printed words are never readable.

Mother: Your train is early.

## Shot 3: The first reversal
```yaml
durationSec: 8
characters: [daughter, mother]
location: counter edge, empty store
camera: over-the-shoulder from the daughter toward the mother
movement: slow handheld drift sideways, revealing the mother's name tag without readable text
mood: accusation turning into confusion
sound: fluorescent buzz, distant thunder
continueFromPrevious: true
```
The daughter says her mother missed graduation, fever nights, and birthdays. The mother reaches toward the hidden box, then stops.

Daughter: You always chose this store.

## Shot 4: A customer reveals the lie
```yaml
durationSec: 8
characters: [daughter]
location: convenience-store entrance
camera: medium close shot of the daughter turning toward the door
movement: quick rack focus from the door chime to the daughter's face
mood: information gap opens
sound: door chime, rain gust, an old customer's soft voice off camera
```
An elderly regular enters and casually mentions the mother worked double shifts for years after the father left, always asking what time school events ended.

## Shot 5: The drawer of absences
```yaml
durationSec: 8
characters: [mother, daughter]
location: back counter drawer
camera: top-down insert on a drawer opening, then close on daughter watching
movement: slow reveal across stacks of folded receipts and small objects
mood: quiet shock
sound: drawer slide, breath catching
references:
  - refs/mother-love-store-reference.png
continueFromPrevious: true
```
The daughter opens the drawer. Every folded receipt has a tiny attached object: a school ribbon, a hospital bracelet, a dried flower, a train ticket stub. No text is readable; the dates are represented by color tabs and objects.

## Shot 6: The real reason
```yaml
durationSec: 8
characters: [mother, daughter]
location: behind the counter, mother and daughter separated by the register
camera: tight two-shot through rain-streaked window reflection
movement: slow push toward their reflected faces
mood: emotional restraint cracking
sound: rain softens, refrigerator hum fades under a low piano note
```
The mother admits she stood outside every event because she smelled like fried food and disinfectant, afraid her daughter would be ashamed.

Mother: I was there. I just stood where you would not have to see me.

## Shot 7: The time capsule
```yaml
durationSec: 8
characters: [mother, daughter]
location: counter under warm light
camera: intimate close-up on the daughter opening the handmade box
movement: slow circular move around their hands
mood: grief becoming love
sound: paper unfolding, daughter's breath breaking
references:
  - refs/mother-love-store-reference.png
continueFromPrevious: true
```
The daughter opens the box. The receipts fold into a tiny paper city: every store shift forming the shape of a path from home to the station.

Daughter: You kept all of this?

## Shot 8: Final emotional release
```yaml
durationSec: 8
characters: [mother, daughter]
location: convenience-store doorway facing the rainy street
camera: vertical silhouette close shot from inside the store
movement: slow pullback as daughter hugs her mother for the first time in years
mood: quiet release, bittersweet hope
sound: rain outside, door chime, one small laugh through tears
transition: hold on the empty counter and the receipt box after they exit frame
continueFromPrevious: true
```
The daughter places her train ticket inside the box, then hugs her mother without saying anything. The mother finally lets herself close her eyes.
