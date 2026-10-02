#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluatePredictionDirectory,
  jsonFiles,
} from "../lib/evaluationMetrics.mjs";

const EVALUATION_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const truthDirectory = path.join(EVALUATION_DIR, "ground-truth-vetted");
const predictionsDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(EVALUATION_DIR, "predictions/gemini");

function format(value) {
  return value.toFixed(3);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

const truthFiles = await jsonFiles(truthDirectory);
if (truthFiles.length === 0) {
  console.log(
    "No vetted ground-truth files found. Add JSON files under evaluation/ground-truth-vetted/ first.",
  );
  process.exit(0);
}

const metrics = await evaluatePredictionDirectory({
  truthDirectory,
  predictionsDirectory,
});
console.log(
  `# Error detection evaluation for ${path.relative(process.cwd(), predictionsDirectory)}`,
);
console.log("");
console.log(`- Vetted samples: ${metrics.samples}`);
console.log(`- Samples with predictions: ${metrics.predictions}`);
console.log(`- Ground-truth errors: ${metrics.groundTruthErrors}`);
console.log(`- Missing prediction files: ${metrics.missingPredictionFiles}`);
console.log(`- Failed model predictions: ${metrics.failedPredictions}`);
console.log(
  `- Missing/failed sample rate: ${format(
    ratio(
      metrics.missingPredictionFiles + metrics.failedPredictions,
      metrics.samples,
    ),
  )}`,
);
console.log(`- True positives: ${metrics.truePositives}`);
console.log(`- False positives: ${metrics.falsePositives}`);
console.log(`- False negatives: ${metrics.falseNegatives}`);
console.log(`- Detection precision: ${format(metrics.precision)}`);
console.log(`- Detection recall: ${format(metrics.recall)}`);
console.log(`- Detection F1: ${format(metrics.f1)}`);
console.log(
  `- Classification accuracy on matched errors: ${format(metrics.categoryAccuracy)}`,
);
if (metrics.averageLatencyMs !== null) {
  console.log(`- Average latency: ${format(metrics.averageLatencyMs)} ms`);
}
if (metrics.p95LatencyMs !== null) {
  console.log(`- P95 latency: ${format(metrics.p95LatencyMs)} ms`);
}
console.log("");
console.log("## Per-category exact-match metrics");
for (const category of new Set([
  ...Object.keys(metrics.actualByCategory),
  ...Object.keys(metrics.predictedByCategory),
])) {
  const correct = metrics.correctByCategory[category] || 0;
  const categoryPrecision = ratio(
    correct,
    metrics.predictedByCategory[category] || 0,
  );
  const categoryRecall = ratio(
    correct,
    metrics.actualByCategory[category] || 0,
  );
  console.log(
    `- ${category}: precision=${format(categoryPrecision)}, recall=${format(categoryRecall)}, ` +
      `correct=${correct}, actual=${metrics.actualByCategory[category] || 0}, ` +
      `predicted=${metrics.predictedByCategory[category] || 0}`,
  );
}
console.log("");
console.log("## Confusion counts");
for (const [actual, row] of Object.entries(metrics.confusion)) {
  for (const [predicted, count] of Object.entries(row)) {
    console.log(`- actual=${actual}, predicted=${predicted}: ${count}`);
  }
}