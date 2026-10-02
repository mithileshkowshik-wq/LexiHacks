#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVALUATION_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const CANDIDATE_DIR = path.join(EVALUATION_DIR, "ground-truth-candidates");
const configurations = {
  baseline: {
    runId: "gpt-5.5-no-guardrail",
    guardrails: false,
    prefix: "",
  },
  guardrail: {
    runId: "gpt-5.5-guardrail",
    guardrails: true,
    prefix: "gpt55-guardrail-",
  },
};
const sampleIds = ["writing-16127", "student-191379", "student-92398"];

const name = process.argv[2];
const configuration = configurations[name];
if (!configuration)
  throw new Error(
    "Usage: import-historical-predictions.mjs baseline|guardrail",
  );

const outputDirectory = path.join(
  EVALUATION_DIR,
  "predictions",
  configuration.runId,
);
await mkdir(outputDirectory, { recursive: true });

for (const sampleId of sampleIds) {
  const candidatePath = path.join(
    CANDIDATE_DIR,
    `${configuration.prefix}${sampleId}.candidate.json`,
  );
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const prediction = {
    sampleId,
    model: "gpt-5.5",
    provider: "independent-agent-visual-review",
    pipeline: "direct-vision",
    guardrails: configuration.guardrails,
    latencyMs: null,
    transcript: "",
    illegibleNote: candidate.illegibleNote || "",
    errors: candidate.errors.map((error) => ({
      id: error.id,
      written: error.written,
      intended: error.intended || "",
      category: error.category,
      confidenceScore: error.confidence ?? null,
      note: error.rationale || "",
    })),
  };
  await writeFile(
    path.join(outputDirectory, `${sampleId}.json`),
    `${JSON.stringify(prediction, null, 2)}\n`,
  );
}

console.log(
  `Imported ${sampleIds.length} historical ${name} prediction file(s).`,
);
