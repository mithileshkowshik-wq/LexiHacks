#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluatePredictionDirectory,
  guardrailProfileFor,
  jsonFiles,
} from "../lib/evaluationMetrics.mjs";

const EVALUATION_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const truthDirectory = path.join(EVALUATION_DIR, "ground-truth-vetted");
const predictionsRoot = path.join(EVALUATION_DIR, "predictions");
const outputFile = path.resolve(
  process.argv[2] || path.join(EVALUATION_DIR, "reports/model-comparison.md"),
);

function decimal(value) {
  return value.toFixed(3);
}

function markdownTable(headers, rows, alignments) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length), 3),
  );
  const cell = (value, index) => {
    const text = String(value);
    if (alignments[index] === "right") return text.padStart(widths[index]);
    if (alignments[index] === "center") {
      const remaining = widths[index] - text.length;
      return `${" ".repeat(Math.floor(remaining / 2))}${text}${" ".repeat(Math.ceil(remaining / 2))}`;
    }
    return text.padEnd(widths[index]);
  };
  const separator = widths.map((width, index) => {
    if (alignments[index] === "right") return `${"-".repeat(width - 1)}:`;
    if (alignments[index] === "center") return `:${"-".repeat(width - 2)}:`;
    return "-".repeat(width);
  });
  const line = (row) => `| ${row.map(cell).join(" | ")} |`;
  return [line(headers), line(separator), ...rows.map(line)];
}

const entries = await readdir(predictionsRoot, { withFileTypes: true });
const runs = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const predictionsDirectory = path.join(predictionsRoot, entry.name);
  const files = await jsonFiles(predictionsDirectory);
  if (files.length === 0) continue;
  const metadata = JSON.parse(await readFile(files[0], "utf8"));
  const metrics = await evaluatePredictionDirectory({
    truthDirectory,
    predictionsDirectory,
  });
  runs.push({ runId: entry.name, metadata, metrics });
}

runs.sort((left, right) => left.runId.localeCompare(right.runId));
const headers = [
  "Run",
  "Model",
  "Provider",
  "Pipeline",
  "Guardrail profile",
  "Samples",
  "GT errors",
  "TP",
  "FP",
  "FN",
  "Precision",
  "Recall",
  "F1",
  "Category accuracy",
  "Avg latency (ms)",
];
const alignments = [
  "left",
  "left",
  "left",
  "left",
  "center",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
  "right",
];
const rows = runs.map(({ runId, metadata, metrics }) => [
  runId,
  metadata.model || "unknown",
  metadata.provider || "unknown",
  metadata.pipeline || "unknown",
  guardrailProfileFor(metadata),
  `${metrics.predictions}/${metrics.samples}`,
  metrics.groundTruthErrors,
  metrics.truePositives,
  metrics.falsePositives,
  metrics.falseNegatives,
  decimal(metrics.precision),
  decimal(metrics.recall),
  decimal(metrics.f1),
  decimal(metrics.categoryAccuracy),
  metrics.averageLatencyMs === null ? "n/a" : decimal(metrics.averageLatencyMs),
]);
const lines = [
  "# LexiPath model comparison",
  "",
  "This table uses strict, case-insensitive exact matching on `written` and `intended` against the same human-vetted ground truth. Model inference is isolated from the ground-truth directory; only this post-run evaluator reads both.",
  "",
  ...markdownTable(headers, rows, alignments),
];

lines.push(
  "",
  "## Interpretation limits",
  "",
  "- The dataset currently contains only three samples, so results are a pilot rather than a population estimate.",
  "- Historical GPT-5.5 rounds did not capture latency.",
  "- Strict text matching penalises transcription differences even when a model notices the same approximate location.",
  "- Live-provider rows should be compared only when they use the same samples, preprocessing setting, guardrails, and ground-truth revision.",
  "",
);

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, lines.join("\n"));
console.log(
  `Wrote ${runs.length} run(s) to ${path.relative(process.cwd(), outputFile)}.`,
);
