#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEvaluationPrompt,
  ERROR_CATEGORIES,
} from "../lib/evaluationPrompt.mjs";
import { PROVIDERS } from "../lib/modelProviders.mjs";
import { loadEvaluationPages } from "../../server/services/evaluationImageLoader.js";

const EVALUATION_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPOSITORY_ROOT = path.resolve(EVALUATION_DIR, "..");

function parseArgs(argv) {
  const options = { guardrailProfile: "full", preprocess: true };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-guardrails") options.guardrailProfile = "none";
    else if (argument === "--no-preprocess") options.preprocess = false;
    else if (argument.startsWith("--")) {
      const name = argument
        .slice(2)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      options[name] = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }
  return options;
}

function safeRunId(value) {
  if (!value || !/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    throw new Error(
      "--run-id must contain only letters, numbers, dots, underscores, or hyphens",
    );
  }
  return value;
}

function normaliseErrors(sampleId, errors, guardrails) {
  if (!Array.isArray(errors)) return [];
  return errors.flatMap((error, index) => {
    const written = typeof error?.written === "string" ? error.written : "";
    const intended = typeof error?.intended === "string" ? error.intended : "";
    const category = ERROR_CATEGORIES.includes(error?.category)
      ? error.category
      : "unsure";
    if (!written) return [];
    if (guardrails && written === intended && category !== "unsure") return [];
    const confidence = Number(error?.confidenceScore ?? error?.confidence);
    return [
      {
        id: `${sampleId}-prediction-${String(index + 1).padStart(3, "0")}`,
        written,
        intended,
        category,
        confidenceScore: Number.isFinite(confidence)
          ? Math.min(1, Math.max(0, confidence))
          : 0.5,
        note: typeof error?.note === "string" ? error.note : "",
      },
    ];
  });
}

async function loadLocalEnvironment() {
  const envFile = path.join(EVALUATION_DIR, ".env");
  try {
    await access(envFile);
    process.loadEnvFile(envFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function runModelEvaluation(options, dependencies = {}) {
  const provider = options.provider;
  const model = options.model;
  const runId = safeRunId(options.runId);
  const invoke = dependencies.invoke || PROVIDERS[provider];
  const guardrailProfile =
    options.guardrailProfile ||
    (options.guardrails === false ? "none" : "full");
  const guardrails = guardrailProfile !== "none";
  if (!invoke) throw new Error(`Unsupported provider: ${provider}`);
  if (!model) throw new Error("--model is required");

  const manifestPath = path.resolve(
    options.manifest || path.join(EVALUATION_DIR, "samples/manifest.json"),
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const outputRoot = path.resolve(
    options.outputRoot || path.join(EVALUATION_DIR, "predictions"),
  );
  const outputDir = path.join(outputRoot, runId);
  const sampleRoot = path.resolve(
    process.env.LEXIPATH_SAMPLE_ROOT || REPOSITORY_ROOT,
  );
  await mkdir(outputDir, { recursive: true });

  for (const sample of manifest) {
    const sourceFile = path.resolve(sampleRoot, sample.sourceFile);
    const images = await (dependencies.loadPages || loadEvaluationPages)(
      sourceFile,
      { preprocess: options.preprocess },
    );
    const prompt = buildEvaluationPrompt(sample, { guardrailProfile });
    const startedAt = performance.now();
    const raw = await invoke({
      model,
      prompt,
      images,
      env: process.env,
      fetchImpl: dependencies.fetchImpl,
    });
    const latencyMs = performance.now() - startedAt;
    const prediction = {
      sampleId: sample.sampleId,
      model,
      provider,
      pipeline: options.preprocess ? "preprocessed-vision" : "direct-vision",
      guardrails,
      guardrailProfile,
      latencyMs: Math.round(latencyMs),
      transcript: typeof raw?.transcript === "string" ? raw.transcript : "",
      illegibleNote:
        typeof raw?.illegibleNote === "string" ? raw.illegibleNote : "",
      errors: normaliseErrors(sample.sampleId, raw?.errors, guardrails),
    };
    await writeFile(
      path.join(outputDir, `${sample.sampleId}.json`),
      `${JSON.stringify(prediction, null, 2)}\n`,
    );
    console.log(
      `completed ${sample.sampleId}: ${prediction.errors.length} candidate error(s)`,
    );
  }

  console.log(
    `predictions written to ${path.relative(REPOSITORY_ROOT, outputDir)}`,
  );
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await loadLocalEnvironment();
  await runModelEvaluation(parseArgs(process.argv.slice(2)));
}
