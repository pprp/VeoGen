---
title: OpenClaw - The Shell Shedding Part 2
synopsis: The second half of the OpenClaw short film, covering adaptive planning, execution, nutrition, stress-day recovery, and the final transformation.
model: veo-3.1-generate-preview
aspectRatio: "16:9"
resolution: "720p"
maxDurationSec: 60
defaultClipDurationSec: 8
generateAudio: true
enhancePrompt: true
personGeneration: allow_adult
style: stylized cel-shaded 3D character animation that matches the reference sheet proportions exactly, rounded cartoon anatomy, soft diffuse lighting, warm cinematic tones, teal UI accents, minimal material realism, no photoreal rendering
negativePrompt: character deformation, extra limbs, broken claws, unreadable UI text, gibberish text, watermarks, flicker, duplicate characters, unstable anatomy
outputDir: outputs
characters:
  - id: claw
    name: Claw
    description: anthropomorphic red lobster, right claw slightly larger than the left, light-colored spot under the left eye, fine scratch on the upper-right back shell, starts exhausted and dull, ends glossy and energetic
    look: >-
      Exact recurring identity must stay fixed across clips: droopy half-lidded eyes without thick eyebrows,
      two thin upright antennae, four thin mouth tendrils, rounded red-orange head shell, pale yellow circular
      spot below the left eye, single silver scratch on the upper-right back shell, broad rounded torso with
      segmented pale underside, right claw slightly larger than left.
    wardrobe: default no clothing unless a shot explicitly asks for it
    voice: none, visual storytelling only
    mannerisms: begins sluggish and heavy, gradually becomes agile, upright, and confident
    referenceImages:
      - refs/Normal-claw.png
---

# Scene 4: Minimal-Cost Plan
OpenClaw 不只给计划，而是给最容易执行下去的计划。

## Shot 4: Adaptive Plan Unfolds
```yaml
durationSec: 8
characters: []
location: digital UI space
camera: isometric wide graphic shot
movement: cards unfolding in layered 3D space
mood: clear, efficient, motivating
sound: crisp card transitions, rhythmic synth ticks, satisfying confirmation ding
```
三张场景卡片在空中展开: 居家、办公室、户外。日历时间线自动排布训练和恢复日，“无器械优先”和“低阻力执行”图标被清晰高亮。

# Scene 5: First Execution
计划第一次落地，Claw 真正开始动起来。

## Shot 5: Living Room Warm-Up
```yaml
durationSec: 8
characters: [claw]
location: cozy living room with soft morning sunlight
timeOfDay: morning
camera: wide shot
movement: smooth lateral track following the character
mood: active, accessible, encouraging
sound: light energetic drums, clean sneaker scuffs, subtle UI accents
references:
  - refs/Normal-claw.png
```
阳光洒进客厅，Claw 跟着 OpenClaw 的节奏完成简单热身。动作还不算完美，但已经明显比第一幕轻快，身体开始重新找回控制感。

# Scene 6: Smart Guidance
执行中不是死板打卡，而是实时纠正与保护。

## Shot 6: Pose Correction Overlay
```yaml
durationSec: 8
characters: [claw]
location: living room
camera: medium shot with phone-camera style overlay
movement: locked framing with animated guidance graphics
mood: safe, technical, reassuring
sound: soft corrective beeps, scanning hum, steady confident beat
references:
  - refs/Normal-claw.png
```
蓝绿色骨骼线叠加在 Claw 身上，AI 标出重心偏移。随着他调整动作，偏差辅助线从橙色变为标准蓝绿色，训练质量被实时修正。

# Scene 7: Daily Nutrition Loop
训练之外，饮食记录也被压缩成几秒就能完成的闭环。

## Shot 7: Breakfast Scan
```yaml
durationSec: 8
characters: []
location: bright dining table
timeOfDay: morning
camera: top-down product shot
movement: quick snap zoom and stabilized hold
mood: fresh, lifestyle, effortless
sound: camera shutter, airy pops, soft UI counting tones
```
俯拍早餐画面，手机对准餐盘拍照。蛋白质、碳水和脂肪三类营养图标立刻浮现，圆环进度条干净利落地完成一次记录。

# Scene 8: Stress-Day Adaptation
真正的价值出现在计划被现实打断的时候。

## Shot 8: Micro-Intervention On A Bad Night
```yaml
durationSec: 8
characters: [claw]
location: dark office, late-night overtime again
timeOfDay: late night
camera: medium close-up
movement: nervous handheld that settles into a stable frame
mood: tense turning into relief
sound: rapid ticking, muffled office tone, then a calming chime and slower breathing
```
又一个深夜加班夜晚，Claw 差点回到原来的崩溃边缘。OpenClaw 弹出“8 分钟微训练 + 3 分钟呼吸重置”的简洁建议，他停下慌乱，跟着提示慢慢把呼吸和状态拉回稳定。

# Scene 9: Visible Progress
一周之后，变化已经不需要解释，画面自己会说明。

## Shot 9: Weekly Dashboard And Transformation
```yaml
durationSec: 8
characters: [claw]
location: bright modern room with floating dashboard graphics
timeOfDay: morning
camera: close-up that widens into a confident medium shot
movement: slow push in, then a gentle reveal around the character
mood: proud, healthy, uplifting
sound: digital count-up, triumphant chord, warm polished brand mnemonic
references:
  - refs/strong-claw.png
```
完成率、恢复评分和连续执行天数在 Claw 身边的蓝绿色数据层中亮起。此时他的甲壳已经恢复健康光泽，姿态挺拔、自信看向前方，OpenClaw 图标与他同框，形成干净有力的品牌收尾。
