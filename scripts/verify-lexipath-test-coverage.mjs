import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(
    path.join(root, "test-plan/lexipath-integration-revised-cases.json"),
    "utf8",
  ),
);
const expected = new Set(manifest.cases.map(({ id }) => id));
const occurrences = new Map([...expected].map((id) => [id, []]));
const idPattern = /\b(?:UT|BI|E2E|RB)-UC\d+-\d{2}\b/g;

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (
        ![
          "node_modules",
          "coverage",
          "dist",
          "test-results",
          "playwright-report",
        ].includes(entry.name)
      ) {
        await collect(target);
      }
      continue;
    }
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
    const source = await readFile(target, "utf8");
    for (const match of source.matchAll(idPattern)) {
      const id = match[0];
      if (!occurrences.has(id)) occurrences.set(id, []);
      occurrences.get(id).push(path.relative(root, target));
    }
  }
}

await collect(path.join(root, "client"));
await collect(path.join(root, "server"));

const missing = [...expected].filter(
  (id) => (occurrences.get(id) ?? []).length === 0,
);
const duplicates = [...expected].filter(
  (id) => (occurrences.get(id) ?? []).length > 1,
);
const unknown = [...occurrences]
  .filter(([id]) => !expected.has(id))
  .map(([id]) => id);

if (missing.length || duplicates.length || unknown.length) {
  if (missing.length)
    console.error(`Missing (${missing.length}): ${missing.join(", ")}`);
  if (duplicates.length) {
    console.error(
      `Duplicate (${duplicates.length}): ${duplicates
        .map((id) => `${id} [${occurrences.get(id).join(", ")}]`)
        .join("; ")}`,
    );
  }
  if (unknown.length)
    console.error(`Unknown (${unknown.length}): ${unknown.join(", ")}`);
  process.exitCode = 1;
} else {
  const levels = Object.groupBy(manifest.cases, ({ level }) => level);
  console.log(
    `LexiPath revised plan: ${expected.size} unique IDs covered ` +
      `(Unit ${levels.Unit.length}, Bottom-up integration ${levels["Bottom-up integration"].length}, ` +
      `System E2E ${levels["System E2E"].length}, Robustness ${levels.Robustness.length}).`,
  );
}
