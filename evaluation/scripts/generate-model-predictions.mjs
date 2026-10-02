#!/usr/bin/env node
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { analyseSample } from "../../server/services/errorClassificationEngine.js";

const REPO_ROOT = path.resolve(new URL("../../", import.meta.url).pathname);
const VETTED_DIR = path.join(REPO_ROOT, "evaluation/ground-truth-vetted");
const PREDICTIONS_ROOT = path.join(REPO_ROOT, "evaluation/predictions");
const requireFromServer = createRequire(
  path.join(REPO_ROOT, "server/package.json"),
);
const { pdf: renderPdf } = await import(
  pathToFileURL(requireFromServer.resolve("pdf-to-img")).href
);
const delayMs = Number(process.env.BENCHMARK_DELAY_MS ?? 1000);
const retryFailedOnly = process.env.BENCHMARK_RETRY_FAILED_ONLY === "true";
const sampleFilter = new Set(
  (process.env.BENCHMARK_SAMPLE_IDS ?? "")
    .split(",")
    .map((sampleId) => sampleId.trim())
    .filter(Boolean),
);
const requestedModels = process.argv.slice(2);
const models =
  requestedModels.length > 0
    ? requestedModels
    : (
        process.env.BENCHMARK_MODELS ??
        process.env.GEMINI_MODEL_NAME ??
        "gemini-flash-latest"
      )
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean);

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not configured. Load server/.env without printing its value.",
  );
}
if (models.length === 0)
  throw new Error("At least one Gemini model is required.");
if (!Number.isFinite(delayMs) || delayMs < 0)
  throw new Error("BENCHMARK_DELAY_MS must be >= 0.");

process.env.USE_MOCK_AI = "false";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeModelName = (model) => model.replace(/[^a-zA-Z0-9._-]/g, "_");
const safeFailureDetail = (error) =>
  String(error?.message ?? error)
    .replaceAll(process.env.GEMINI_API_KEY, "[REDACTED]")
    .slice(0, 500);
const renderedPages = new Map();
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "hermes-eval-"));

async function pagePathsFor(sourcePath, sampleId) {
  if (path.extname(sourcePath).toLowerCase() !== ".pdf") return [sourcePath];
  if (renderedPages.has(sourcePath)) return renderedPages.get(sourcePath);

  const document = await renderPdf(sourcePath, { scale: 2 });
  const pagePaths = [];
  let pageIndex = 0;
  for await (const page of document) {
    const pagePath = path.join(temporaryRoot, `${sampleId}-p${pageIndex}.png`);
    await writeFile(pagePath, page);
    pagePaths.push(pagePath);
    pageIndex += 1;
  }
  if (pagePaths.length === 0)
    throw new Error(`PDF rendered no pages for ${sampleId}`);
  renderedPages.set(sourcePath, pagePaths);
  return pagePaths;
}

const groundTruthFiles = (await readdir(VETTED_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .filter(
    (filename) =>
      sampleFilter.size === 0 ||
      sampleFilter.has(path.basename(filename, ".json")),
  )
  .sort();

if (groundTruthFiles.length === 0)
  throw new Error("No vetted ground-truth files were found.");

let failures = 0;
try {
  for (const model of models) {
    process.env.GEMINI_MODEL_NAME = model;
    const outputDir = path.join(PREDICTIONS_ROOT, safeModelName(model));
    await mkdir(outputDir, { recursive: true });
    console.log(
      `\n[benchmark] model=${model} samples=${groundTruthFiles.length}`,
    );

    for (const [index, filename] of groundTruthFiles.entries()) {
      const truth = JSON.parse(
        await readFile(path.join(VETTED_DIR, filename), "utf8"),
      );
      const sourcePath = path.resolve(REPO_ROOT, truth.sourceFile);
      await stat(sourcePath);
      const pagePaths = await pagePathsFor(sourcePath, truth.sampleId);
      const outputPath = path.join(outputDir, filename);
      if (retryFailedOnly) {
        try {
          const existing = JSON.parse(await readFile(outputPath, "utf8"));
          if (existing.status === "ok") {
            console.log(
              `[benchmark] ${index + 1}/${groundTruthFiles.length} ${truth.sampleId}: skip existing success`,
            );
            continue;
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }

      const startedAt = Date.now();
      let prediction;
      try {
        const result = await analyseSample({
          taskType: truth.taskType,
          title: truth.sampleId,
          pages: pagePaths.map((imagePath) => ({
            imagePath,
            originalFilename: path.basename(sourcePath),
          })),
        });
        prediction = {
          sampleId: truth.sampleId,
          sourceFile: truth.sourceFile,
          model,
          pipeline: "direct-vision",
          status: "ok",
          latencyMs: Date.now() - startedAt,
          illegibleNote: result.illegibleNote,
          errors: result.errors.map(
            ({
              written,
              intended,
              category,
              confidenceScore,
              note,
              locationOnScan,
            }) => ({
              written,
              intended,
              category,
              confidenceScore,
              note,
              locationOnScan,
            }),
          ),
        };
        console.log(
          `[benchmark] ${index + 1}/${groundTruthFiles.length} ${truth.sampleId}: ` +
            `ok errors=${prediction.errors.length} latencyMs=${prediction.latencyMs}`,
        );
      } catch (error) {
        failures += 1;
        const failureDetail = safeFailureDetail(error);
        prediction = {
          sampleId: truth.sampleId,
          sourceFile: truth.sourceFile,
          model,
          pipeline: "direct-vision",
          status: "failed",
          latencyMs: Date.now() - startedAt,
          failureReason:
            error?.name === "TimeoutError" ? "timeout" : "model-request-failed",
          failureDetail,
          errors: [],
        };
        console.error(
          `[benchmark] ${index + 1}/${groundTruthFiles.length} ${truth.sampleId}: ` +
            `failed reason=${prediction.failureReason} latencyMs=${prediction.latencyMs} ` +
            `detail=${failureDetail}`,
        );
      }

      const temporaryPath = `${outputPath}.tmp-${process.pid}`;
      await writeFile(
        temporaryPath,
        `${JSON.stringify(prediction, null, 2)}\n`,
      );
      await rename(temporaryPath, outputPath);
      if (delayMs > 0 && index + 1 < groundTruthFiles.length)
        await sleep(delayMs);
    }
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log(
  `\n[benchmark] complete models=${models.length} failures=${failures}`,
);
if (failures > 0) process.exitCode = 2;
