#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePredictionDirectory } from "../lib/evaluationMetrics.mjs";

const evaluationDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const truthDirectory = path.join(evaluationDirectory, "ground-truth-vetted");
const predictionsRoot = path.join(evaluationDirectory, "predictions");
const manifest = JSON.parse(
  await readFile(
    path.join(evaluationDirectory, "samples/manifest.json"),
    "utf8",
  ),
);
const runIds = process.argv.slice(2);
if (runIds.length === 0) {
  throw new Error("Pass at least one prediction run ID");
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function f1(precision, recall) {
  return precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
}

function decimal(value) {
  return value.toFixed(3);
}

function labelFor(metadata) {
  if (metadata.provider === "gemini") return "Gemini Flash";
  if (metadata.provider === "openrouter") return "Qwen 2.5 VL 72B";
  if (metadata.provider === "cloudflare") return "Cloudflare Llama 3.2 Vision";
  return metadata.model || metadata.provider || "Unknown";
}

function aggregate(sampleMetrics) {
  const totals = sampleMetrics.reduce(
    (sum, sample) => ({
      truePositives: sum.truePositives + sample.truePositives,
      falsePositives: sum.falsePositives + sample.falsePositives,
      falseNegatives: sum.falseNegatives + sample.falseNegatives,
    }),
    { truePositives: 0, falsePositives: 0, falseNegatives: 0 },
  );
  const precision = ratio(
    totals.truePositives,
    totals.truePositives + totals.falsePositives,
  );
  const recall = ratio(
    totals.truePositives,
    totals.truePositives + totals.falseNegatives,
  );
  return { ...totals, precision, recall, f1: f1(precision, recall) };
}

const runs = [];
for (const runId of runIds) {
  const predictionsDirectory = path.join(predictionsRoot, runId);
  const metadata = JSON.parse(
    await readFile(
      path.join(predictionsDirectory, `${manifest[0].sampleId}.json`),
      "utf8",
    ),
  );
  const strict = await evaluatePredictionDirectory({
    truthDirectory,
    predictionsDirectory,
    matchingMode: "strict",
  });
  const lenient = await evaluatePredictionDirectory({
    truthDirectory,
    predictionsDirectory,
    matchingMode: "lenient-category-aware",
  });
  runs.push({ runId, metadata, strict, lenient, label: labelFor(metadata) });
}

const lines = [
  "# Lenient category-aware model evaluation by sample type",
  "",
  "This pilot rerun uses the same raw-image, no-guardrail pipeline for all models. A prediction counts as a true positive only when its category matches the ground truth and its `written` and `intended` spans are either exact or one is a whole-word subspan of the other. This credits equivalent localisation such as `run` → `runs` versus `He run` → `He runs`, but does not credit unrelated text, fuzzy transcription guesses, or the correct correction with the wrong category.",
  "",
  "## Overall rerun",
  "",
  "| Model | TP | FP | FN | Precision | Recall | F1 | Strict F1 | Avg latency |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
];
for (const run of runs) {
  lines.push(
    `| ${run.label} | ${run.lenient.truePositives} | ${run.lenient.falsePositives} | ${run.lenient.falseNegatives} | ${decimal(run.lenient.precision)} | ${decimal(run.lenient.recall)} | ${decimal(run.lenient.f1)} | ${decimal(run.strict.f1)} | ${decimal(run.lenient.averageLatencyMs / 1000)}s |`,
  );
}

lines.push(
  "",
  "## Per-sample results",
  "",
  "| Model | Sample | Handwriting | Length | Format | GT | Predicted | TP | FP | FN | F1 | Latency |",
  "| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const run of runs) {
  for (const sample of manifest) {
    const metrics = run.lenient.perSample[sample.sampleId];
    lines.push(
      `| ${run.label} | ${sample.sampleId} | ${sample.handwriting} | ${sample.textLength} | ${sample.sampleFormat} | ${metrics.groundTruthErrors} | ${metrics.predictedErrors} | ${metrics.truePositives} | ${metrics.falsePositives} | ${metrics.falseNegatives} | ${decimal(metrics.f1)} | ${decimal(metrics.latencyMs / 1000)}s |`,
    );
  }
}

for (const [heading, field] of [
  ["Handwriting", "handwriting"],
  ["Text length", "textLength"],
  ["Sample format", "sampleFormat"],
]) {
  lines.push(
    "",
    `## ${heading}`,
    "",
    "| Model | Group | Samples | TP | FP | FN | Precision | Recall | F1 |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  const groups = [...new Set(manifest.map((sample) => sample[field]))];
  for (const run of runs) {
    for (const group of groups) {
      const samples = manifest.filter((sample) => sample[field] === group);
      const metrics = aggregate(
        samples.map((sample) => run.lenient.perSample[sample.sampleId]),
      );
      lines.push(
        `| ${run.label} | ${group} | ${samples.length} | ${metrics.truePositives} | ${metrics.falsePositives} | ${metrics.falseNegatives} | ${decimal(metrics.precision)} | ${decimal(metrics.recall)} | ${decimal(metrics.f1)} |`,
      );
    }
  }
}

lines.push(
  "",
  "## Interpretation limits",
  "",
  "- This is a three-sample pilot: one messy/long narrative and two neat/short edit-and-diagram samples. The dimensions overlap, so differences cannot be attributed causally to handwriting, length, or format.",
  "- Each provider was run once per sample; latency and model outputs can vary between runs.",
  "- The matcher is deliberately bounded and deterministic. It is more lenient about span boundaries, not spelling similarity, and still requires the exact category.",
  "- Ground truth contains 22 errors in total, with 19 concentrated in the messy narrative sample.",
  "",
);

const outputFile = path.join(
  evaluationDirectory,
  "reports/lenient-sample-type-analysis.md",
);
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, lines.join("\n"));
console.log(`Wrote ${path.relative(process.cwd(), outputFile)}`);
