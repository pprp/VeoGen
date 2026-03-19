#!/usr/bin/env node

import { Command } from "commander";

import {
  planProject,
  renderProject,
  stitchFromManifest,
  summarizePlan,
} from "./orchestrator.js";
import { relativeToCwd } from "./utils.js";

const program = new Command();

function collectRepeatedOption(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

program
  .name("veogen")
  .description("Markdown-first Gemini Veo short video orchestrator")
  .version("0.1.0");

program
  .command("plan")
  .description("Parse markdown script and build a render plan without calling Gemini")
  .requiredOption("-s, --script <path>", "Path to the markdown script")
  .option("-o, --output <path>", "Explicit run directory for generated plan artifacts")
  .option("-m, --model <name>", "Override Veo model name")
  .option(
    "--shot <selector>",
    "Limit planning to specific shots by global index, shot id, or 'last' (repeatable)",
    collectRepeatedOption,
    [],
  )
  .option("-j, --json <path>", "Write normalized plan JSON to a specific path")
  .action(async (options) => {
    const plan = await planProject({
      scriptPath: options.script,
      outputDir: options.output,
      modelOverride: options.model,
      shotSelectors: options.shot,
      jsonOutputPath: options.json,
    });

    console.log(summarizePlan(plan));
    if (options.json) {
      console.log(`\nPlan JSON written to ${relativeToCwd(options.json)}`);
    }
  });

program
  .command("render")
  .description("Generate Veo clips from markdown script and optionally stitch them")
  .requiredOption("-s, --script <path>", "Path to the markdown script")
  .option("-o, --output <path>", "Explicit run directory")
  .option("-m, --model <name>", "Override Veo model name")
  .option(
    "--shot <selector>",
    "Render only specific shots by global index, shot id, or 'last' (repeatable)",
    collectRepeatedOption,
    [],
  )
  .option("--dry-run", "Build prompts and plan files without calling Gemini", false)
  .option("--skip-stitch", "Skip final ffmpeg concatenation", false)
  .option("--poll-ms <ms>", "Polling interval for long-running Gemini operations", "30000")
  .option("--inter-shot-delay-ms <ms>", "Delay between clip submissions", "20000")
  .action(async (options) => {
    const manifest = await renderProject({
      scriptPath: options.script,
      outputDir: options.output,
      modelOverride: options.model,
      shotSelectors: options.shot,
      dryRun: options.dryRun,
      skipStitch: options.skipStitch,
      pollMs: Number(options.pollMs),
      interShotDelayMs: Number(options.interShotDelayMs),
    });

    console.log(`Run dir: ${relativeToCwd(manifest.runDir)}`);
    console.log(`Manifest: ${relativeToCwd(`${manifest.runDir}/manifest.json`)}`);
    if (manifest.finalVideoPath) {
      console.log(`Final video: ${relativeToCwd(manifest.finalVideoPath)}`);
    }
  });

program
  .command("stitch")
  .description("Stitch completed clips from an existing render manifest")
  .requiredOption("-m, --manifest <path>", "Path to render manifest JSON")
  .option("-o, --output <path>", "Explicit output file path for final video")
  .action(async (options) => {
    const outputPath = await stitchFromManifest(options.manifest, options.output);
    console.log(`Final video: ${relativeToCwd(outputPath)}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
