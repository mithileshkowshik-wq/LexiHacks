import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function jsonFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function normaliseText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function surfaceText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim();
}

function errorKey(error) {
  return `${normaliseText(error?.written)}::${normaliseText(error?.intended)}`;
}

function words(value) {
  return normaliseText(value).match(/[\p{L}\p{N}']+/gu) ?? [];
}

function containsWords(container, candidate) {
  if (candidate.length === 0 || candidate.length > container.length)
    return false;
  return container.some((_, index) =>
    candidate.every((word, offset) => container[index + offset] === word),
  );
}

function sameOrNestedPhrase(left, right) {
  const leftWords = words(left);
  const rightWords = words(right);
  return (
    containsWords(leftWords, rightWords) || containsWords(rightWords, leftWords)
  );
}

function proposesCorrection(error) {
  const written = surfaceText(error?.written);
  const intended = surfaceText(error?.intended);
  return written.length > 0 && intended.length > 0 && written !== intended;
}

function identifiesOverlappingError(actual, predicted) {
  if (!sameOrNestedPhrase(actual.written, predicted.written)) return false;
  if (normaliseText(actual.written) === normaliseText(predicted.written))
    return true;

  if (
    new Set(["capitalisation", "punctuation"]).has(predicted.category) &&
    surfaceText(predicted.written) !== surfaceText(predicted.intended)
  ) {
    return true;
  }

  const predictedWrittenWords = new Set(words(predicted.written));
  const predictedIntendedWords = new Set(words(predicted.intended));
  const overlappingActualWords = words(actual.written).filter((word) =>
    predictedWrittenWords.has(word),
  );
  return overlappingActualWords.some(
    (word) => !predictedIntendedWords.has(word),
  );
}

export function correctionMatchScore(
  actual,
  predicted,
  matchingMode = "strict",
) {
  const exact = errorKey(actual) === errorKey(predicted);
  if (matchingMode === "strict") return exact ? 2 : 0;
  if (
    !new Set(["lenient-category-aware", "recognition-partial-credit"]).has(
      matchingMode,
    )
  ) {
    throw new Error(`Unsupported matching mode: ${matchingMode}`);
  }

  const sameCategory = actual.category === predicted.category;
  const equivalentSpans =
    sameOrNestedPhrase(actual.written, predicted.written) &&
    sameOrNestedPhrase(actual.intended, predicted.intended);

  if (matchingMode === "lenient-category-aware") {
    if (!sameCategory) return 0;
    if (exact) return 2;
    return equivalentSpans ? 1 : 0;
  }

  if (sameCategory && (exact || equivalentSpans)) return 2;
  if (!proposesCorrection(predicted)) return 0;
  return identifiesOverlappingError(actual, predicted) ? 1 : 0;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function guardrailProfileFor(prediction) {
  if (prediction.guardrailProfile) return prediction.guardrailProfile;
  return prediction.guardrails ? "full/legacy" : "none";
}

export async function evaluatePredictionDirectory({
  truthDirectory,
  predictionsDirectory,
  matchingMode = "strict",
}) {
  const truthFiles = await jsonFiles(truthDirectory);
  const metrics = {
    samples: truthFiles.length,
    predictions: 0,
    missingPredictionFiles: 0,
    failedPredictions: 0,
    groundTruthErrors: 0,
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    fullMatches: 0,
    partialMatches: 0,
    categoryMatches: 0,
    latencyTotalMs: 0,
    latencyCount: 0,
    latencies: [],
    confusion: {},
    actualByCategory: {},
    predictedByCategory: {},
    correctByCategory: {},
    perSample: {},
  };

  for (const truthFile of truthFiles) {
    const truth = JSON.parse(await readFile(truthFile, "utf8"));
    metrics.groundTruthErrors += truth.errors.length;
    for (const error of truth.errors) {
      metrics.actualByCategory[error.category] =
        (metrics.actualByCategory[error.category] || 0) + 1;
    }
    const sampleMetrics = {
      groundTruthErrors: truth.errors.length,
      predictedErrors: 0,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      fullMatches: 0,
      partialMatches: 0,
      latencyMs: null,
    };
    metrics.perSample[truth.sampleId] = sampleMetrics;
    const predictionFile = path.join(
      predictionsDirectory,
      `${truth.sampleId}.json`,
    );
    let prediction;
    try {
      prediction = JSON.parse(await readFile(predictionFile, "utf8"));
      metrics.predictions += 1;
    } catch (error) {
      if (error.code === "ENOENT") {
        metrics.missingPredictionFiles += 1;
        metrics.falseNegatives += truth.errors.length;
        sampleMetrics.falseNegatives += truth.errors.length;
        continue;
      }
      throw error;
    }

    if (prediction.status === "failed") metrics.failedPredictions += 1;

    if (typeof prediction.latencyMs === "number") {
      metrics.latencyTotalMs += prediction.latencyMs;
      metrics.latencyCount += 1;
      metrics.latencies.push(prediction.latencyMs);
      sampleMetrics.latencyMs = prediction.latencyMs;
    }

    const remaining = [...truth.errors];
    sampleMetrics.predictedErrors = (prediction.errors || []).length;
    for (const predicted of prediction.errors || []) {
      metrics.predictedByCategory[predicted.category] =
        (metrics.predictedByCategory[predicted.category] || 0) + 1;
      let matchIndex = -1;
      let matchScore = 0;
      remaining.forEach((actual, index) => {
        const score = correctionMatchScore(actual, predicted, matchingMode);
        if (score > matchScore) {
          matchIndex = index;
          matchScore = score;
        }
      });
      if (matchIndex < 0) {
        metrics.falsePositives += 1;
        sampleMetrics.falsePositives += 1;
        continue;
      }

      const [actual] = remaining.splice(matchIndex, 1);
      const credit =
        matchingMode === "recognition-partial-credit" ? matchScore / 2 : 1;
      metrics.truePositives += credit;
      sampleMetrics.truePositives += credit;
      metrics.falsePositives += 1 - credit;
      sampleMetrics.falsePositives += 1 - credit;
      metrics.falseNegatives += 1 - credit;
      sampleMetrics.falseNegatives += 1 - credit;
      if (credit === 1) {
        metrics.fullMatches += 1;
        sampleMetrics.fullMatches += 1;
      } else {
        metrics.partialMatches += 1;
        sampleMetrics.partialMatches += 1;
      }
      const actualCategory = actual.category;
      const predictedCategory = predicted.category;
      metrics.confusion[actualCategory] ||= {};
      metrics.confusion[actualCategory][predictedCategory] =
        (metrics.confusion[actualCategory][predictedCategory] || 0) + credit;
      if (actualCategory === predictedCategory) {
        metrics.categoryMatches += credit;
        metrics.correctByCategory[actualCategory] =
          (metrics.correctByCategory[actualCategory] || 0) + credit;
      }
    }
    metrics.falseNegatives += remaining.length;
    sampleMetrics.falseNegatives += remaining.length;
  }

  metrics.precision = ratio(
    metrics.truePositives,
    metrics.truePositives + metrics.falsePositives,
  );
  metrics.recall = ratio(
    metrics.truePositives,
    metrics.truePositives + metrics.falseNegatives,
  );
  metrics.f1 =
    metrics.precision + metrics.recall === 0
      ? 0
      : (2 * metrics.precision * metrics.recall) /
        (metrics.precision + metrics.recall);
  metrics.categoryAccuracy = ratio(
    metrics.categoryMatches,
    metrics.truePositives,
  );
  metrics.averageLatencyMs =
    metrics.latencyCount === 0
      ? null
      : metrics.latencyTotalMs / metrics.latencyCount;
  const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
  metrics.p95LatencyMs =
    sortedLatencies.length === 0
      ? null
      : sortedLatencies[
          Math.max(0, Math.ceil(sortedLatencies.length * 0.95) - 1)
        ];
  for (const sample of Object.values(metrics.perSample)) {
    sample.precision = ratio(
      sample.truePositives,
      sample.truePositives + sample.falsePositives,
    );
    sample.recall = ratio(
      sample.truePositives,
      sample.truePositives + sample.falseNegatives,
    );
    sample.f1 =
      sample.precision + sample.recall === 0
        ? 0
        : (2 * sample.precision * sample.recall) /
          (sample.precision + sample.recall);
  }
  return metrics;
}
