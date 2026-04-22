---
title: Red Cloth Bag
synopsis: One ordinary Chinese woman spends her life hurrying between study, factory work, family care, hospital errands, and market labor, always carrying the same red cloth bag until someone finally carries it for her.
model: veo-3.1-fast-generate-preview
aspectRatio: "9:16"
resolution: "720p"
maxDurationSec: 64
defaultClipDurationSec: 8
generateAudio: true
enhancePrompt: true
personGeneration: allow_adult
style: Chinese social realist short film, documentary naturalism, plain everyday locations, practical light, restrained emotion, tactile details of work-worn hands and ordinary homes, no fantasy, no glamour
negativePrompt: subtitles, captions, readable text, watermarks, luxury lifestyle, fantasy effects, sentimental glow, warped faces, extra fingers, broken hands, duplicate people
outputDir: outputs
characters:
  - id: mei
    name: Mei
    description: ordinary Chinese woman shown across different ages, observant eyes, practical expression, becomes more tired and weathered as life passes
    wardrobe: age-appropriate plain Chinese everyday clothing, always with a small worn red cloth bag that grows faded and patched over time
    voice: quiet, low, rarely speaking
    mannerisms: moves quickly, checks the time, grips the red cloth bag strap, keeps working even when exhausted
  - id: child
    name: Child
    description: Mei's child, first seen as a school-age child and later as a grown adult, caring but often in a hurry
    wardrobe: simple school clothes when young, modest office clothing when adult
    voice: soft and concerned
    mannerisms: reaches for Mei's hand, watches her work, later tries to take the burden from her
  - id: elder
    name: Elder
    description: Mei's elderly parent, frail Chinese elder with careful movements
    wardrobe: plain quilted home jacket, soft cotton shoes
    voice: weak and quiet
    mannerisms: leans on Mei's arm, holds medicine carefully
---
# Scene 1: A Life Of Hurrying
The film follows one Chinese woman's life through concrete daily actions rather than narration. The red cloth bag is the visual anchor: books, work gloves, groceries, medicine, market money, and finally an empty thermos pass through it as decades move by.

## Shot 1: Before School
```yaml
durationSec: 8
characters: [mei]
location: small rural Chinese home with damp courtyard and dim kitchen stove
timeOfDay: cold dawn
camera: close handheld shot at child height, following young Mei's hands
movement: quick practical movement from stove to doorway
mood: childhood already shaped by responsibility
sound: rooster calls, stove crackle, bicycle bell far away
```
Young Mei, about eight years old, stuffs a schoolbook and half a steamed bun into a bright red cloth bag. She blows out the stove, checks that a sleeping younger sibling is covered, then runs out before the sky is fully light.

## Shot 2: Factory Shift
```yaml
durationSec: 8
characters: [mei]
location: crowded coastal factory workshop with sewing machines and fluorescent light
timeOfDay: late night
camera: tight side profile on young adult Mei at a machine
movement: rhythmic locked-off frame interrupted by her tired blink
mood: mechanical endurance
sound: sewing machines, electric fans, distant factory buzzer
```
Mei is now a young adult in a factory uniform. Her red cloth bag hangs from the chair, faded from years of use. She rubs her wrist once, then immediately returns to the machine as rows of workers continue under harsh light.

## Shot 3: Bus With A Child
```yaml
durationSec: 8
characters: [mei, child]
location: packed city bus during morning commute, steamed windows, plastic hand straps
timeOfDay: gray morning rush hour
camera: compressed medium shot in the aisle
movement: swaying with the bus as Mei balances too many things
mood: tenderness squeezed by time
sound: bus brakes, coins, muffled traffic, a child coughing softly
```
Middle-aged Mei stands in the bus aisle with the red cloth bag, a vegetable bundle, and her sleepy child leaning against her coat. She gives the child the only free handhold and braces herself with one shoulder.

## Shot 4: Midnight Kitchen
```yaml
durationSec: 8
characters: [mei, child, elder]
location: cramped apartment kitchen and dining table, ordinary Chinese family home
timeOfDay: midnight
camera: slow lateral move across three simultaneous tasks
movement: from boiling pot, to child's homework, to elder's medicine cup
mood: invisible labor without pause
sound: pressure cooker hiss, pencil scratching, medicine bottle cap, upstairs footsteps
```
Mei cooks leftovers, checks the child's homework, and supports Elder with a cup of medicine in the same continuous motion. Her own bowl sits untouched and cooling beside the red cloth bag.

## Shot 5: Hospital Corridor
```yaml
durationSec: 8
characters: [mei, elder]
location: public hospital corridor with plastic chairs and pale morning light
timeOfDay: early morning
camera: close shot on Mei's hands, then a tired two-shot
movement: small push-in as she kneels to adjust Elder's shoes
mood: duty, worry, no self-pity
sound: hospital announcement tone without readable words, rolling cart wheels, soft coughing
```
Older Mei kneels in the corridor to tie Elder's shoe while holding medicine bags and the red cloth bag under one arm. She notices her own hand shaking, hides it, then helps Elder stand again.

## Shot 6: Market Before Sunrise
```yaml
durationSec: 8
characters: [mei]
location: wet neighborhood market stall with baskets of vegetables and a small awning
timeOfDay: before sunrise
camera: close-up of weathered hands sorting vegetables, then reveals older Mei
movement: steady handheld move from hands to face
mood: survival by habit
sound: rain dripping from awning, plastic crates, distant delivery carts
```
Mei, now gray-haired, opens a tiny vegetable stall while the street is still dark. The red cloth bag is patched and tied to the stall pole. She counts small bills, coughs into her sleeve, and keeps arranging vegetables.

## Shot 7: Empty Table
```yaml
durationSec: 8
characters: [mei]
location: quiet apartment dining table after the child has grown up and moved away
timeOfDay: late evening
camera: static medium shot with empty chair visible
movement: almost still, only Mei's small movements
mood: exhaustion arriving after everyone else has gone
sound: refrigerator hum, ticking wall clock, distant elevator door
```
Elder's chair is empty. The child's old school bag is neatly folded on a shelf. Mei sits alone with one bowl of plain noodles, still wearing her market apron. She starts to eat, but falls asleep with chopsticks in her hand.

## Shot 8: Someone Carries It
```yaml
durationSec: 8
characters: [mei, child]
location: quiet riverside path in a Chinese city park, morning walkers in the distance
timeOfDay: soft morning light
camera: gentle rear three-quarter two-shot
movement: slow walking shot that finally lets the pace relax
mood: small release, not a grand ending
sound: birds, distant tai chi music, thermos lid opening, slow footsteps
```
Old Mei walks with the red cloth bag still on her shoulder. Her grown child arrives beside her, quietly takes the bag, and carries it without speaking. Mei resists for one second, then lets go. For the first time, she walks with empty hands.
