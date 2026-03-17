# VeoGen

`VeoGen` 是一个 **以 Markdown 为核心入口** 的 Gemini Veo 编排脚手架，用来生成 **最长 120 秒** 的短视频。

它适合这样的工作流：

- 用 `.md` 撰写短片脚本
- 在 frontmatter 中维护角色设定（角色圣经）
- 为角色、镜头或整体风格添加可选参考图
- 在共享一致性提示的基础上生成多个 Veo 片段
- 最后使用 `ffmpeg` 将片段拼接成完整短视频

---

## 项目定位

这个项目不是“只发一次请求生成一段视频”的简单示例，而是一个 **短片级别的视频生成流水线**。

你可以把它理解成三层：

1. **脚本层**：用 Markdown 描述故事、镜头、角色和参数
2. **规划层**：把脚本解析成标准化的渲染计划
3. **执行层**：生成 prompts、调用 Gemini Veo、记录状态并拼接视频

所以它更像一个稳定的后端编排核心，适合先把生产流程跑通，再逐步扩展 UI、队列、配音、字幕等能力。

---

## 为什么这样设计

根据 Gemini 视频生成接口当前文档，Veo 的一些约束会直接影响项目结构设计：

- 单个生成 clip 不足以支撑 2 分钟短片，因此需要拆分成多个镜头
- 单次携带的参考图最多 **3 张**
- 请求 `1080p` 或启用参考图时，通常要求使用 **8 秒 clip**
- **视频续写（extension）** 与 **参考图（reference images）** 不能同时使用

这些规则会在规划阶段被检查，并把相关警告写入：

- `plan.json`
- `manifest.json`

也就是说，`VeoGen` 会先帮你做“规则约束 + 可执行计划”，再进入真正的生成流程。

---

## 安装

先安装依赖：

```bash
npm install --cache .npm-cache
```

---

## 配置 API Key

项目通过环境变量读取 Gemini API Key：

```bash
export GEMINI_API_KEY=your_key_here
```

请把 `your_key_here` 替换成你的真实密钥。

如果你使用的是 macOS + `zsh`，有两种常见方式：

### 临时生效（仅当前终端）

```bash
export GEMINI_API_KEY=你的真实密钥
```

### 长期生效（推荐）

把下面这行加入 `~/.zshrc`：

```bash
export GEMINI_API_KEY=你的真实密钥
```

然后执行：

```bash
source ~/.zshrc
```

---

## Markdown 脚本格式约定

脚本文件采用如下结构：

1. 顶部使用 YAML frontmatter 存放项目级配置和角色定义
2. `# Scene Title` 表示一个场景
3. `## Shot Title` 表示一个可渲染镜头
4. 每个镜头内部可以有一个可选的 fenced `yaml` 代码块，用于填写结构化镜头参数
5. YAML 代码块下面写自由格式的动作、对白、调度说明

示例：

````md
---
title: 我的短片
aspectRatio: '16:9'
resolution: '720p'
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

---

## 推荐的理解方式

你可以把一个短片脚本理解为：

- **frontmatter**：全局约束与角色设定
- **Scene**：故事段落和空间切换
- **Shot**：真正会触发一次生成的镜头单位
- **shot 内 YAML**：每个镜头的结构化控制参数
- **shot 正文**：自然语言补充描述

这使得文本表达自由度和程序可控性之间保持平衡。

---

## 常用命令

### 1. 只构建计划，不调用 API

```bash
npm run plan -- --script examples/demo-short.md
```

适合第一次上手时检查：

- Markdown 结构是否正确
- frontmatter 是否合法
- shot 参数是否被正确解析
- 是否触发了 API 约束警告

---

### 2. 全流程 Dry Run

```bash
npm run render -- --script examples/demo-short.md --dry-run
```

这一步会：

- 解析脚本
- 生成 prompts
- 写出 `plan.json` 和 `manifest.json`
- 模拟一次完整渲染流程
- **但不会真正调用 Veo 接口**

适合在正式渲染前检查整个工作流是否符合预期。

---

### 3. 正式渲染并拼接视频

```bash
npm run render -- --script examples/demo-short.md
```

这一步会真正：

- 调用 Gemini Veo
- 生成各个镜头 clip
- 记录执行状态
- 最终尝试拼接出完整视频

---

### 4. 基于已有结果重新拼接

```bash
npm run dev -- stitch --manifest outputs/<run-id>/manifest.json
```

如果镜头已经生成完成，只想重新拼接最终成片，可以使用这条命令。

---

## 输出目录结构

每次运行都会生成一个独立输出目录：

```text
outputs/<run-id>/
  clips/
  prompts/
  plan.json
  manifest.json
  final-video.mp4
```

各文件/目录作用如下：

- `clips/`：生成出来的镜头视频片段
- `prompts/`：每个镜头对应的最终提示词
- `plan.json`：标准化后的规划结果
- `manifest.json`：执行过程记录，包含每个 shot 的状态、远端 URI 和输出信息
- `final-video.mp4`：最终拼接后的视频文件

---

## 核心规则说明

### 参考图最多 3 张

单个请求最多只能携带 3 张参考图，因此项目会做优先级分配：

1. 优先保留当前镜头中活跃角色的参考图
2. 如果还有剩余空间，再加入一个可选的风格参考图

### 续写模式与参考图互斥

如果某个 shot 设置了 `continueFromPrevious: true`，项目会自动切换到 **视频续写模式**。

这种情况下，`VeoGen` 会自动移除该镜头请求中的参考图，因为 Gemini API 不支持“续写 + 参考图”同时使用。

### 规划阶段会输出警告

如果你的脚本触发了这些限制，项目不会默默失败，而是把信息写入计划或执行记录中，方便排查。

---

## 推荐的第一次使用流程

如果你是第一次接触这个项目，建议按照下面的顺序：

### 路线 A：先理解流程

1. 安装依赖
2. 设置 `GEMINI_API_KEY`
3. 阅读 `examples/demo-short.md`
4. 运行 `plan`
5. 运行 `render --dry-run`
6. 查看 `outputs/` 下生成的计划和 prompts
7. 确认无误后再正式渲染

### 路线 B：直接改自己的脚本

1. 复制 `examples/demo-short.md`
2. 修改标题、角色、场景和镜头内容
3. 添加你自己的参考图路径
4. 先运行 `plan`
5. 再运行 `render --dry-run`
6. 最后正式调用渲染

---

## 适合什么场景

这个项目尤其适合下面这些需求：

- 希望把一个短片拆成多个镜头系统化生成
- 希望维持角色一致性和画面风格一致性
- 希望对镜头时长、相机运动、参考图等因素进行结构化控制
- 希望先把后端编排流程跑通，再逐步补齐产品层能力

---

## 你需要额外留意的事项

### 1. 先确保 API Key 可用

没有正确配置 `GEMINI_API_KEY`，正式渲染无法工作。

### 2. 最终拼接通常依赖 `ffmpeg`

项目说明中明确提到使用 `ffmpeg` 做视频拼接，因此如果你要得到最终合成视频，系统中通常需要具备可用的 `ffmpeg`。

如果你已经能成功生成 clips，但最终拼接失败，优先检查这一项。

### 3. 建议先跑 Dry Run

第一次不要直接正式渲染，先通过 `plan` 和 `dry-run` 检查脚本结构、镜头拆分和 prompts，这样更容易定位问题。

---

## 一个最短可行上手路径

如果你只想最快跑起来，可以按下面做：

```bash
npm install --cache .npm-cache
export GEMINI_API_KEY=你的真实密钥
npm run plan -- --script examples/demo-short.md
npm run render -- --script examples/demo-short.md --dry-run
```

确认输出没问题后，再执行：

```bash
npm run render -- --script examples/demo-short.md
```

---

## 项目当前边界

根据现有说明，`VeoGen` 目前更偏向 **backend-first scaffold**，重点是：

- 脚本解析
- 计划生成
- 提示词组织
- Veo 调用编排
- 输出记录
- 成片拼接

它并不试图一次性提供完整产品能力，如：

- Web UI
- 渲染队列管理
- 资产库管理
- 配音系统
- 字幕工作流

这些可以在现有编排核心稳定后继续扩展。

---

## 一句话总结

`VeoGen` 的核心价值是：

> 用 Markdown 写短片脚本，把它自动拆成多个 Veo 镜头进行规划、生成与拼接，形成一条可复用的短视频生产流水线。

如果你希望进一步完善中文文档，下一步可以继续补：

- `README.md` 中英双语互链
- “常见报错与排查”章节
- “从零写一个脚本”教程
- 各个 `src/` 文件职责说明
