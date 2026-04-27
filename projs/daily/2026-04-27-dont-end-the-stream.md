---
title: Don't End The Stream
synopsis: At their mother's funeral livestream in a small Chinese apartment, two camera-savvy siblings receive a gift from the dead woman's own account telling them not to end the broadcast, and the auto-play footage exposes every act of care they only performed for viewers while the daughter everyone called unfilial was the one who stayed when no light was on.
model: veo-3.1-fast-generate-preview
aspectRatio: "9:16"
resolution: "720p"
maxDurationSec: 96
defaultClipDurationSec: 8
generateAudio: true
enhancePrompt: true
personGeneration: allow_adult
style: pseudo-documentary family social thriller, funeral-livestream inserts, county-town Chinese apartment realism, practical mourning-hall light, restrained performances, emotional humiliation without gore, no supernatural spectacle
negativePrompt: subtitles, captions, readable text, watermarks, fantasy magic, gore, excessive blood, ghost visual effects, warped faces, broken hands, extra fingers, duplicate mourners, glossy influencer lighting, comedy tone
outputDir: outputs
seed: 4272026
characters:
  - id: lan
    name: Lan
    description: 34-year-old daughter and lifestyle livestream host, polished face trained to stay composed under attention, grief and image management tangled together
    wardrobe: neat black mourning dress, subtle makeup not yet fully removed, clip-on microphone hidden in the collar
    voice: soft and controlled in public, sharp when control slips
    mannerisms: checks framing before speaking, fixes other people's clothes on instinct, smiles one beat too long
  - id: bo
    name: Bo
    description: 38-year-old elder son, local salesman with practiced filial confidence, broad face and quick temper when exposed
    wardrobe: black shirt with white mourning flower pinned at the chest, expensive watch, phone always in hand
    voice: loud, comforting for strangers, impatient in private
    mannerisms: steps toward cameras first, touches shoulders for effect, lowers his voice only when talking about money
  - id: qiao
    name: Qiao
    description: 27-year-old youngest daughter, night-shift hospital laundry worker, exhausted eyes, rough hands, carries love like a duty rather than a performance
    wardrobe: faded gray work jacket over plain black clothes, damp canvas shoes, cheap paper mourning flower pinned crookedly
    voice: low, tired, almost never defending herself
    mannerisms: stands at room edges, warms other people's hands without thinking, keeps her phone face-down
  - id: mother
    name: Mother
    description: 68-year-old widow with a thin frame and observant eyes, physically weak near the end but mentally exact, notices who only comes alive when the red light turns on
    wardrobe: plain floral home blouse, dark knit vest, light blanket over her knees in recorded clips
    voice: faint but dry, never wasting words
    mannerisms: watches before speaking, smooths blankets for others, turns her face away from pity she does not trust
---
# Scene 1: The Funeral Broadcast
Content direction: family social observation with a dark reversal and an emotional final judgment. Style definition: pseudo-documentary cinematic realism with livestream and hidden-phone inserts. In the first three seconds, a gift tone interrupts the funeral livestream and the sender is unmistakably Mother.

## Shot 1: The Gift Tone
```yaml
durationSec: 8
characters: [lan, bo, mother]
location: cramped county-town apartment turned into a mourning hall, portrait, incense, white flowers, and a ring light beside the livestream tripod
timeOfDay: 2:16 p.m.
camera: handheld documentary push from the livestream phone to Mother's portrait and back to Lan's face
movement: sudden jolt toward the memorial table the instant the gift sound cuts through the room
mood: instant hook, public grief violated by something impossible
sound: incense crackle, low room murmur, bright livestream gift chime, Mother's recorded voice
```
Lan is thanking unseen viewers in her soft mourning voice when a bright gift tone slices through the room. The sender icon on the livestream phone is Mother's face. Her voice plays clearly over the speaker.

Mother: Do not end the stream yet.

## Shot 2: The Old Phone Wakes
```yaml
durationSec: 8
characters: [lan, bo]
location: same mourning hall, memorial table crowded with fruit, candles, and framed photos
camera: tight handheld close-up on Bo's hand reaching behind the portrait
movement: fast grab toward the source of the sound, then a shocked recoil
mood: disbelief becoming panic
sound: chair legs scraping, Bo's breathing, another phone vibration under the incense tray
```
Bo lunges to shut the livestream off, but the sound is coming from Mother's old keypad phone taped behind the portrait frame. Its dead screen wakes by itself and begins auto-playing a queued video toward Lan's stream.

Bo: Who touched this phone?

## Shot 3: Wait For The Ring Light
```yaml
durationSec: 8
characters: [bo, mother]
location: hidden phone footage from Mother's bedroom a week before her death
camera: fixed low angle from a shelf facing the bed, plain room light and no flattering framing
movement: static frame with only Bo and Mother moving in and out of it
mood: first reversal, kindness exposed as staging
sound: ring light click, spoon tapping porcelain, Mother swallowing dryly
```
In the old clip, Bo raises a spoon toward Mother's lips, then stops to turn on a ring light and smooth his own expression. Only after the red light appears does he lean in with practiced tenderness. The clip cuts one second after recording ends, showing the untouched porridge still full.

## Shot 4: Say It Again, Mom
```yaml
durationSec: 8
characters: [lan, mother]
location: second hidden phone clip in the same bedroom, afternoon window light on the blanket
camera: fixed medium shot from the bedside cabinet, slightly off-center and unpolished
movement: no camera movement, only Lan resetting the scene inside the frame
mood: information gap tightening into humiliation
sound: clip-on microphone rustle, fruit bag crinkle, Mother's tired inhale
```
Lan kneels beside the bed with a peeled orange arranged perfectly in Mother's hand.

Lan: Say it one more time. Tell them I come every day.

Mother tries to repeat the line. The second Lan thinks she has the take, she lifts the untouched fruit back into the gift bag.

## Shot 5: The Unfilial Daughter
```yaml
durationSec: 8
characters: [lan, bo, qiao]
location: apartment doorway opening into the crowded mourning room
camera: shoulder-height documentary shot that swings from the memorial table to the front door
movement: abrupt pan as Qiao appears in wrinkled work clothes carrying cheap white chrysanthemums
mood: public accusation, tension looking for the easiest target
sound: door latch, damp shoes on tile, Bo's voice turning hard
```
Qiao arrives straight from her night shift, hair still flattened from a hospital cap, holding a small bundle of discount chrysanthemums. Bo turns on her instantly, angry now that the room is full and the stream is still running.

Bo: Now you come? When the cameras are already here?

Qiao says nothing. She only sets the flowers down with both hands.

## Shot 6: After Midnight
```yaml
durationSec: 8
characters: [qiao, mother]
location: third hidden phone clip, Mother's bedroom at 2 a.m. with only corridor spill light
camera: wide static frame from the same shelf, no ring light, grainier and darker than the other clips
movement: still camera, quiet human movement within it
mood: emotional reversal, private care without witness
sound: kettle lid tremble, ointment cap opening, Mother's relieved breath
```
The next clip is dim and uncomposed. Qiao enters in the same work jacket, kneels by the bed, warms Mother's feet between her palms, changes a pain patch, and reads tomorrow's weather in a whisper so Mother can sleep easier. Her own phone stays face-down on the floor the whole time.

## Shot 7: When The Red Light Turns On
```yaml
durationSec: 8
characters: [mother]
location: same bedroom, Mother alone in frame after Qiao has left
camera: close static shot from the hidden phone with Mother's face turned slightly toward the lens
movement: no camera movement, only Mother's small effort to sit more upright
mood: rule revealed, intimate judgment
sound: ceiling fan hum, distant traffic, Mother's thin steady voice
```
Mother looks directly at the hidden phone, speaking as if she knew this moment would come.

Mother: When the little red light turned on, they remembered I was their mother.
Mother: When it turned off, they remembered the time.

## Shot 8: The Kitchen Plan
```yaml
durationSec: 8
characters: [lan, bo]
location: hidden phone audio and partial doorway view into the apartment kitchen the night before the funeral
camera: accidental sliver of the kitchen visible through a half-open bedroom door
movement: almost none, only shadows crossing the narrow visible gap
mood: dark social twist, grief turned into a project
sound: refrigerator hum, lowered voices, glasses touching the counter
```
From the half-open bedroom door, the hidden phone catches Bo and Lan speaking in low urgent tones, assuming Mother is asleep.

Bo: Keep the stream going through the bowing. More people send gifts when the crying starts.
Lan: Fine. But the apartment key stays with me after the guests leave.

## Shot 9: The Daughter You Missed
```yaml
durationSec: 8
characters: [qiao, mother]
location: montage of hidden phone clips across several nights in the same bedroom
camera: repeated fixed-angle fragments from the shelf, stitched by time rather than movement
movement: no camera movement, only a progression of repeated late-night actions
mood: tenderness finally gaining evidence
sound: thermos lid, wet towel wrung out, Qiao's sleeve brushing the blanket
```
Night after night, the same plain frame repeats: Qiao washing Mother's hair with a basin on the floor, rubbing medicine into swollen fingers, eating a cold bun beside the bed so Mother is not awake alone, falling asleep with her forehead resting on the mattress edge.

## Shot 10: No One Inherits My Suffering
```yaml
durationSec: 8
characters: [mother]
location: final pre-recorded clip from Mother's bedroom, daylight, blanket neatly folded over her lap
camera: centered medium shot, calmer and more deliberate than the earlier hidden clips
movement: subtle forward creep as if the phone was propped more carefully this time
mood: final verdict, dignity taking control back
sound: distant street vendor outside the window, Mother's dry even voice
```
Mother sits upright, weaker but perfectly clear.

Mother: The flat is already gone.
Mother: I sold it to fund the elder day room downstairs for one year.
Mother: No one gets to inherit my illness.

## Shot 11: Turn Off The Light
```yaml
durationSec: 8
characters: [lan, bo, qiao]
location: mourning hall with the livestream tripod still aimed at the family
camera: medium documentary shot from the still-running livestream phone toward the three siblings
movement: fixed frame as Qiao steps into it and folds the ring light downward
mood: emotional release with public shame still hanging in the air
sound: ring light hinge clicking shut, Bo failing to speak, Lan's breath breaking
```
Lan's polished mourning face finally collapses, but the room looks harsher now without the flattering light. Qiao reaches past the tripod and quietly folds the ring light down so the only brightness left comes from the phone screen and the candles.

## Shot 12: Cry Where No One Counts
```yaml
durationSec: 8
characters: [qiao, mother]
location: same mourning hall, seen from the forgotten livestream phone as the room falls dim
camera: locked vertical frame with Qiao nearest the memorial table and the others receding into shadow
movement: static frame, only small human motion inside it
mood: final philosophical sting, love separated from performance
sound: candle crackle, one last phone playback hiss, Mother's final recorded line
```
In the dim frame, Qiao rests one rough hand against the edge of Mother's folded blanket and lowers her head for the first time all day. Behind her, Bo and Lan stand frozen, stripped of poses. Mother's last queued line plays over the dying speaker.

Mother: If you still want to cry, do it where love cannot be counted.
