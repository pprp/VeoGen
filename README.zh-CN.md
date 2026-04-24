# VeoGen

[English](./README.md)

`VeoGen` 是一个以 Markdown 为入口的 Gemini Veo 编排脚手架，用来把短视频脚本转成可执行的渲染计划、逐镜头 prompts、生成后的 clips，以及可选的最终拼接视频。

当前状态：实验性 `v0.1`。仓库已经适合公开展示和直接从源码运行，但目前还不是一个已发布到 npm 的工具包。

## 它能做什么

- 用 Markdown 写场景和镜头，而不是手工拼接 API 请求
- 从一个想法或现有剧本启动自动化多 Agent pipeline
- 用 YAML frontmatter 维护项目配置和角色设定
- 给角色、镜头和整体风格挂参考图
- 在正式渲染前检查 Gemini 视频接口的关键约束
- 用 `--dry-run` 跑完整流程但不调用 API
- 用 `--shot` 只重跑指定镜头
- 落盘 `plan.json` 和 `manifest.json`，方便排查、恢复和重新拼接

## 为什么这个仓库长这样

`VeoGen` 不是“发一个 prompt 直接出整片”的演示，而是一个面向短片工作流的轻量编排层。

当前 Gemini 视频接口的一些限制会直接影响项目设计：

- 一个短片通常需要多个 clip，而不是一次生成整段视频
- 单次请求最多只能带 3 张参考图
- 请求 `1080p` 或使用参考图时，clip 时长必须是 8 秒
- 视频续写和参考图不能在同一次请求里同时使用

这些规则会在规划阶段被检查，并把警告写进 `plan.json` 和 `manifest.json`。

参考文档：[Gemini video generation docs](https://ai.google.dev/gemini-api/docs/video?example=dialogue)

## 运行要求

- Node.js `>=20`
- 如果你要输出最终拼接视频，需要系统里有 `ffmpeg`
- 可用的 `GEMINI_API_KEY`，并且账号有 Gemini 视频模型访问权限
- 本地克隆这个仓库

## 快速开始

```bash
git clone <repo-url>
cd VeoGen
npm install --cache .npm-cache

export GEMINI_API_KEY=your_key_here

npm run plan -- --script projs/examples/demo-short.min.md
npm run render -- --script projs/examples/demo-short.min.md --dry-run
```

确认 dry-run 输出没有问题后，再正式渲染：

```bash
npm run render -- --script projs/examples/demo-short.min.md
```

如果你更喜欢用 `.env`，`run.sh` 会自动加载它：

```bash
echo 'GEMINI_API_KEY=your_key_here' > .env
bash run.sh dry-run projs/examples/demo-short.min.md
```

第一次上手建议直接看 [`projs/examples/demo-short.min.md`](./projs/examples/demo-short.min.md)，它不需要额外参考图即可直接跑通。
如果你想看带参考图的示例，再用 [`projs/examples/demo-short.md`](./projs/examples/demo-short.md)。

## Agent Pipeline

仓库现在包含一个更高层的 `pipeline` 命令，会串起五个 Agent：

- 剧本生成 Agent
- 剧本审核 Agent
- 角色创建 Agent
- 角色评估 Agent
- 导演 Agent

这条 pipeline 可以从一个想法或现有剧本起步，把所有中间产物写到 `outputs/.../development/`，生成最终 markdown 剧本，再把这个剧本交给现有的 Veo 渲染/拼接流程。
如果剧本审核 Agent 判定存在明确问题，pipeline 现在还会自动插入一轮剧本修订 Agent，再继续后续角色和导演环节。
如果启用了角色图生成，多角色项目会先生成共享的 `cast-lineup.png` 阵容母版；当图片编辑能力可用时，再从这张母版派生单人角色参考图。角色评估 Agent 会在一致性分数低于阈值时自动触发角色图返工。

Dry-run 示例：

```bash
npm run dev -- pipeline \
  --idea "A burnt-out courier races through a flooded neon city with a stolen memory drive before sunrise." \
  --dry-run \
  --skip-character-images
```

完整运行需要：

- `GEMINI_API_KEY`，用于剧本/评审/导演/角色评估 Agent、角色图生成，以及最终视频渲染阶段
- 只有当你用 `--character-image-provider openai` 选择 OpenAI 生成角色参考图时，才需要 `OPENAI_API_KEY`

常用选项：

- `--script <path>`：从现有剧本启动，而不是从 idea 启动
- `--skip-render`：只产出最终剧本和 planning 产物，不执行最终视频生成
- `--skip-character-images`：跳过角色图生成，让开发阶段保持纯文本
- `--character-image-provider gemini|openai`：选择角色参考图生成后端
- `--character-image-model <model>`：覆盖图片模型，例如使用 OpenAI 时指定 `gpt-image-2`
- `--character-threshold <score>`：控制角色一致性分数低于多少时自动触发返工
- `--character-refinement-rounds <count>`：限制自动角色返工最多跑几轮，默认 `2`
- `--model <name>`：覆盖最终渲染阶段使用的 Veo 模型

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev -- pipeline --idea "your idea" --dry-run --skip-character-images` | 从一个想法启动自动化 Agent pipeline，但不调用外部生成 API |
| `npm run dev -- pipeline --script projs/examples/demo-short.min.md --dry-run` | 从现有剧本启动自动化 Agent pipeline |
| `npm run plan -- --script projs/examples/demo-short.min.md` | 解析最小内置脚本并生成渲染计划，不调用 Gemini |
| `npm run render -- --script projs/examples/demo-short.min.md --dry-run` | 为最小内置脚本生成 prompts、plan 和 manifest，但不发起 API 请求 |
| `npm run render -- --script projs/examples/demo-short.min.md` | 真正生成最小内置脚本的 clips 并尝试拼接 |
| `npm run render -- --script projs/examples/demo-short.min.md --shot 2 --shot scene-01-shot-03` | 只重跑最小内置脚本中的指定镜头 |
| `npm run render -- --script projs/examples/demo-short.md --skip-stitch` | 生成带参考图的示例，但跳过 `ffmpeg` 拼接 |
| `npm run dev -- stitch --manifest outputs/<run-id>/manifest.json` | 基于已有 manifest 重新拼接 |
| `npm run typecheck` | 执行 TypeScript 类型检查 |

## 快捷入口脚本

`run.sh` 对常见流程做了一层薄封装，并且会自动解析 `projs/` 下的项目目录：

```bash
bash run.sh
bash run.sh fast
bash run.sh plan projs/examples/demo-short.min.md
bash run.sh render drawio-proj --shot last
bash run.sh stitch --manifest outputs/some-run/manifest.json
```

`bash run.sh fast` 默认使用 `veo-3.1-fast-generate-preview`，除非你显式传入 `--model` 覆盖。

## 项目结构

```text
src/                         核心解析器、规划器、prompt 构建、Gemini 客户端、拼接器
projs/examples/              内置示例入口，包含最小版本和带参考图版本
projs/Fitness-proj/          较完整的示例项目
projs/drawio-proj/           参考图更重的示例项目
outputs/                     运行产物，包括计划、prompts、clips、manifest 和成片
run.sh                       CLI 的便捷包装脚本
```

## 脚本格式

每个脚本由以下部分组成：

1. YAML frontmatter，存放项目级配置和角色定义
2. `# Scene Title`，表示场景
3. `## Shot Title`，表示可渲染镜头
4. 每个镜头内部可选的 fenced `yaml` 代码块，用来写结构化镜头参数
5. YAML 下方的自由 Markdown 文本，用来写动作、对白和调度说明

示例：

````md
---
title: 我的短片
aspectRatio: "16:9"
resolution: "720p"
maxDurationSec: 120
characters:
  - id: hero
    name: Hero
    description: 专注的年轻女性，短银发
    referenceImages:
      - refs/hero.jpg
---

# Scene 1
场景说明文本。

## Shot 1
```yaml
durationSec: 8
characters: [hero]
camera: slow push-in
references:
  - refs/room.jpg
```
主角推开门，终于走进房间。
````

## Frontmatter 字段

| 字段 | 含义 |
| --- | --- |
| `title` | 项目标题，也会参与输出目录命名 |
| `synopsis` | 可选的项目摘要 |
| `model` | Gemini 视频模型名，默认取 `veo-3.0-generate-preview`，也可通过 `VEO_MODEL` 覆盖 |
| `aspectRatio` | `16:9` 或 `9:16` |
| `resolution` | `720p` 或 `1080p` |
| `maxDurationSec` | 项目总时长上限，最大 `120` |
| `defaultClipDurationSec` | 默认镜头时长，最大 `8` |
| `generateAudio` | 是否生成音频 |
| `enhancePrompt` | 是否启用 prompt enhancement |
| `personGeneration` | `allow_adult` 或 `dont_allow` |
| `negativePrompt` | 可选的负面提示词 |
| `style` | 可选的全局风格描述 |
| `styleReferenceImages` | 项目级风格参考图 |
| `outputDir` | 输出根目录，默认 `outputs` |
| `seed` | 可选的项目级随机种子 |
| `characters` | 角色数组，每个角色可带 `referenceImages` |

说明：`generateAudio`、`enhancePrompt`、`negativePrompt` 和 `seed` 现在都会在真正发起渲染请求时端到端生效。

## Shot YAML 字段

| 字段 | 含义 |
| --- | --- |
| `durationSec` | 镜头时长，最大 `8` 秒 |
| `characters` | 当前镜头活跃的角色 id |
| `location` | 可选的地点描述 |
| `timeOfDay` | 可选的时间描述 |
| `camera` | 构图、镜头语言或镜头参数说明 |
| `movement` | 摄影机或主体运动 |
| `mood` | 情绪和氛围 |
| `sound` | 声音、对白或音效说明 |
| `references` | 镜头级参考图路径 |
| `continueFromPrevious` | 续写前一个已生成镜头，而不是纯文本起步 |
| `transition` | 可选的转场说明 |
| `seedOffset` | 每个镜头对 seed 的偏移量 |

## 输出文件

每次运行都会生成一个独立目录：

```text
outputs/<run-id>/
  clips/
  prompts/
  plan.json
  manifest.json
  final-video.mp4
```

- `plan.json` 是标准化并通过校验的执行计划
- `manifest.json` 是执行记录，包含每个镜头的状态、远端 URI 和最终输出信息
- `prompts/` 保存每个镜头最终发送的 prompt
- `clips/` 保存下载到本地的视频片段
- `final-video.mp4` 只有在未跳过拼接且拼接成功时才会生成

## 关键行为说明

- 参考图有预算限制。系统会优先选择当前镜头活跃角色的参考图和镜头级参考图；如果还有空位，再补 1 张风格参考图。
- 创作 pipeline 会先用共享阵容母版生成多角色参考，再产出单人角色 sheet，以降低首轮角色风格漂移。
- 请求 `1080p` 或携带参考图时，规划阶段会自动把镜头时长修正为 8 秒。
- 如果某个镜头设置了 `continueFromPrevious: true`，VeoGen 会把它切换成视频续写模式，并移除该请求中的参考图。
- `--shot` 支持全局镜头序号、shot id，或者 `last`。
- 如果你只选择一个依赖续写的镜头，但没有把它的前一个镜头一起放进同一次运行，规划阶段会直接报错。
- 最终拼接依赖 `ffmpeg`，会先尝试 stream copy，失败后再回退到重新编码。

## 当前边界

这个仓库刻意保持 backend-first，只解决编排核心：

- 脚本解析
- 计划校验
- prompt 落盘
- Gemini clip 生成
- manifest 持久化
- 最终拼接

它目前还不包含 UI、任务队列、素材管理、字幕工作流或配音流水线。
