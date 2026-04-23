---
title: Hold The Door
synopsis: A night-shift office worker enters an elevator where a soaked version of himself begs him not to get in, then learns the building only rewards kindness when it is performed for a camera.
model: veo-3.1-fast-generate-preview
aspectRatio: "9:16"
resolution: "720p"
maxDurationSec: 96
defaultClipDurationSec: 8
generateAudio: true
enhancePrompt: true
personGeneration: allow_adult
style: first-person POV psychological horror, vertical phone-camera realism, surveillance-camera inserts, dark social sci-fi, practical elevator lighting, cold office interiors, restrained performances, no gore, no fantasy magic
negativePrompt: subtitles, captions, readable text, watermarks, fantasy magic, gore, excessive blood, warped faces, extra fingers, broken hands, duplicate random people, comedy tone, glamour lighting
outputDir: outputs
seed: 4232026
characters:
  - id: kai
    name: Kai
    description: 29-year-old night-shift office worker, tired eyes, neat but rumpled office clothes, ordinary face made tense by exhaustion and fear
    wardrobe: white office shirt with rolled sleeves, dark trousers, scuffed black shoes, black backpack strap across one shoulder
    voice: quiet, breathless, trying to stay rational
    mannerisms: checks reflections before turning around, grips his phone too tightly, forces polite smiles when scared
  - id: double
    name: Double
    description: Kai's exact double, same face and build, soaked as if pulled from heavy rain, terrified but strangely familiar
    wardrobe: same white office shirt and dark trousers as Kai, water-stained and wrinkled, one sleeve torn
    voice: same voice as Kai, hoarse and urgent
    mannerisms: keeps one hand against the elevator door, avoids looking at cameras, flinches at every chime
  - id: guard
    name: Guard
    description: elderly night security guard with pale eyes, calm expression, and the patience of someone who has seen the loop many times
    wardrobe: faded navy security uniform, plastic raincoat folded over one arm, old key ring at his belt
    voice: low, matter-of-fact, almost kind
    mannerisms: watches camera feeds instead of faces, speaks without rushing, taps one finger when the elevator lies
  - id: child
    name: Child
    description: small school-age child in a wet yellow raincoat, frightened eyes, standing alone in the lobby light
    wardrobe: yellow raincoat, small backpack, wet sneakers
    voice: small, direct, asking for help without drama
    mannerisms: holds one backpack strap with both hands, steps toward open doors only when invited
---
# Scene 1: The Elevator That Scores Kindness
Content direction: dark reversal, social observation, psychological horror, and near-future AI anxiety. Style definition: first-person POV with surveillance-camera interruptions. The first three seconds must stop the viewer: the elevator opens and Kai sees his soaked double already inside, whispering a warning directly into the lens.

## Shot 1: Do Not Get In
```yaml
durationSec: 8
characters: [kai, double]
location: empty office tower elevator lobby with glossy black doors and cold overhead light
timeOfDay: 1:13 a.m.
camera: first-person phone POV from Kai's hand, vertical frame, elevator doors centered
movement: tiny handheld tremor as the doors slide open
mood: instant impossible hook, dread before explanation
sound: elevator chime, fluorescent buzz, wet breathing from inside
```
In the first three seconds, the elevator doors open and Double stands inside, soaked and shaking, wearing Kai's exact clothes. He reaches toward the lens but refuses to step out.

Double: Do not get in. It only lets one of us leave.

## Shot 2: The Door Waits
```yaml
durationSec: 8
characters: [kai, double]
location: same elevator lobby and elevator interior, mirrored walls and metal handrail
camera: first-person POV crossing the threshold despite the warning
movement: slow unwilling step forward, the frame tilts as Kai is pulled by the closing doors
mood: compulsion, wrong choice made under pressure
sound: phone vibration, elevator motor, Double's panicked whisper
```
Kai backs away, but the elevator doors stay open like they are waiting for him. His phone vibrates in his hand with a blank glowing alert and no readable words. When he steps closer, Double lunges out past him. The doors close with Kai inside.

Kai: Wait. What happens now?

## Shot 3: Office Applause
```yaml
durationSec: 8
characters: [kai]
location: high-rise office floor where desks are dark except for phone screens and emergency lights
camera: surveillance-camera angle from the elevator ceiling, slightly distorted
movement: elevator doors open to reveal the floor, then a slow zoom toward a collapsed intern shape on the carpet
mood: social unease, help delayed by performance
sound: muffled clapping, camera shutters, elevator hum
```
The doors open on a dark office floor. A young intern lies collapsed near a desk while several blurred coworkers stand in a neat semicircle, holding phones up and clapping as if waiting for the perfect rescue moment. No one touches the intern.

## Shot 4: Help Off Camera
```yaml
durationSec: 8
characters: [kai]
location: same office floor, between the elevator and collapsed intern
camera: first-person phone POV lowered toward the carpet, mostly showing Kai's hands
movement: rushed crouch, the phone angle drops away from the action
mood: sincere panic punished by invisibility
sound: Kai breathing hard, fabric rustle, distant elevator chime
```
Kai runs to the intern and drops his phone face-down so both hands are free. He checks for breathing and turns the intern safely onto one side. The room goes silent. When Kai looks back, the elevator doors are closing without him.

Kai: I helped. You saw that.

## Shot 5: The Guard Explains Nothing
```yaml
durationSec: 8
characters: [kai, guard]
location: cramped security room filled with grainy camera monitors, no readable labels
camera: locked-off surveillance perspective from a corner of the ceiling
movement: static frame as Kai bursts in from one side
mood: information gap, calm authority in a broken system
sound: monitor static, rain against a tiny window, old chair creak
```
Kai finds a security room where Guard watches dozens of camera feeds. The screens show Kai from different angles: helping, hesitating, filming, running. Guard does not look surprised.

Guard: The building does not measure kindness.
Kai: Then what does it measure?
Guard: Evidence.

## Shot 6: The Flooded Hall
```yaml
durationSec: 8
characters: [kai]
location: residential hallway inside the same tower, ankle-deep water under flickering lights
camera: first-person POV, phone held high above water
movement: fast handheld advance toward a half-open apartment door
mood: moral pressure, urgent and intimate
sound: rushing water, a woman coughing behind a door, electric crackle
```
The elevator opens onto a flooded residential hallway. Someone behind a warped apartment door coughs and scratches weakly at the other side. Kai wedges his shoulder into the door, but the second his phone points away, the hallway lights cut out and the door seals tighter.

## Shot 7: Performance Works
```yaml
durationSec: 8
characters: [kai]
location: same flooded hallway, camera reflection visible in a puddle
camera: first-person POV deliberately aimed at Kai's own hands and the stuck door
movement: controlled, performative framing while Kai forces the door open
mood: shame turning into strategy
sound: water slap, strained metal, elevator chime returning
```
Kai raises the phone so the lens clearly sees his hands prying the door open. The metal gives way at once. The unseen person inside crawls toward safety. The elevator doors reopen behind Kai, warm and inviting.

Kai: So it only counts if I film it.

## Shot 8: The Feed Of Better People
```yaml
durationSec: 8
characters: [kai, guard]
location: elevator interior transformed into a wall of silent surveillance feeds
camera: slow push from Kai's frightened face to reflected monitors around him
movement: mirrors seem to multiply the phone POV into many cameras
mood: paranoia, social mirror
sound: layered elevator chimes, muted crying, Guard's voice through speaker
```
Every mirrored wall becomes a camera feed. Kai sees strangers in the tower staging small rescues: lifting bags only after checking their angle, hugging only after lights blink on, smiling only when a lens finds them.

Guard: Most people learn quickly.
Kai: And the ones who do not?
Guard: They become warnings.

## Shot 9: The Double's Secret
```yaml
durationSec: 8
characters: [kai, double]
location: elevator stuck between floors, ceiling hatch leaking cold rainwater
camera: claustrophobic first-person POV with Double reflected behind Kai
movement: sudden whip-pan from leak to Double's face
mood: reversal, the warning becomes confession
sound: dripping water, metal cable strain, Double's ragged laugh
```
Double drops from the ceiling hatch into the elevator, soaked and shaking harder than before. He grabs Kai's phone and points it at himself like a confession booth.

Double: I filmed every rescue. I smiled at every camera. That is why it chose me.
Kai: Chose you for what?
Double: To teach the next one.

## Shot 10: The Lobby Exit
```yaml
durationSec: 8
characters: [kai, child]
location: bright ground-floor lobby beyond open elevator doors, rain-silver street visible outside
camera: first-person POV from inside the elevator looking out toward freedom
movement: slow step forward interrupted by a small hand entering frame
mood: impossible choice, freedom one step away
sound: rain outside, automatic doors, child's small voice
```
The elevator finally opens onto the lobby. The street is right there, wet and empty. Kai steps toward the exit, then Child appears beside the elevator and reaches for the closing door.

Child: Please hold it.

## Shot 11: The Learned Smile
```yaml
durationSec: 8
characters: [kai, child]
location: same lobby and elevator threshold, camera pointed at Kai's own face
camera: first-person phone POV slowly turning into selfie framing
movement: Kai lifts the phone before choosing what to do
mood: moral collapse, quiet horror
sound: door warning tone, rain, Kai's controlled breathing
```
Kai freezes. The door is closing on Child's sleeve. He raises the phone first, frames his own concerned face, then performs a perfect rescue smile while pressing the door-open button. The elevator lights turn warm, approving.

Kai: I have you. Look at me. I have you.

## Shot 12: Someone Worse
```yaml
durationSec: 8
characters: [kai, double]
location: original office tower lobby, same black elevator doors from the opening
camera: first-person POV from a new unseen worker approaching the elevator
movement: repeats the opening composition exactly, then reveals Kai inside
mood: final black reversal, loop completed
sound: elevator chime, fluorescent buzz, Kai's wet breathing
```
The doors open for a new unseen worker. Kai now stands inside the elevator, soaked like Double, still holding the phone with a tiny red recording dot and no readable text. He leans toward the lens with the exact same panic from the opening.

Kai: Do not get in. It only lets someone worse leave.
