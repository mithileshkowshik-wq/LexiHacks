import { readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rankKnowledgeDocuments } from '../../server/services/recommendationEngine.js';
import {
  resourceIdFromBlobPath,
  runtimeInputFor,
  scorePilot,
  validatePilot,
} from '../lib/retrievalPilot.mjs';

const evaluationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const retrievalRoot = path.join(evaluationRoot, 'retrieval');
const vaultRoot = path.resolve(
  process.env.KNOWLEDGE_VAULT_PATH ?? path.join(os.homedir(), 'KnowledgeVault')
);
const corpusRoot = path.join(vaultRoot, '_deploy', 'azure-knowledge-vault');

function normalise(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function loadJson(name) {
  return JSON.parse(await readFile(path.join(retrievalRoot, name), 'utf8'));
}

async function loadDocuments() {
  const wikiRoot = path.join(corpusRoot, 'wiki');
  const entries = await readdir(wikiRoot, { recursive: true, withFileTypes: true });
  const markdownPaths = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();

  return Promise.all(
    markdownPaths.map(async (filePath) => {
      const blobPath = path.relative(corpusRoot, filePath).split(path.sep).join('/');
      const content = await readFile(filePath, 'utf8');
      return { blobPath, content, searchText: normalise(`${blobPath} ${content}`) };
    })
  );
}

function percent(numerator, denominator) {
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function markdownReport(result, families, queries, corpusDocuments) {
  const familyLabel = new Map(families.map((family) => [family.familyId, family.label]));
  const queryForm = new Map(queries.map((query) => [query.queryId, query.form]));
  const lines = [
    '# Retrieval robustness pilot',
    '',
    `- Corpus: local Azure deployment mirror (${corpusDocuments} Markdown documents)`,
    `- Queries: ${result.summary.queries}`,
    `- Top-1 family hit: ${result.summary.top1Hits}/${result.summary.queries} (${percent(result.summary.top1Hits, result.summary.queries)})`,
    `- Top-3 family hit: ${result.summary.top3Hits}/${result.summary.queries} (${percent(result.summary.top3Hits, result.summary.queries)})`,
    `- All four variants succeed @3: ${result.summary.familiesAllVariantsAt3}/${result.summary.families} families`,
    '',
    '| Family | Query form | First acceptable rank | Top 1 | Top 3 | Failure reason |',
    '|---|---|---:|:---:|:---:|---|',
  ];
  for (const item of result.queries) {
    lines.push(
      `| ${familyLabel.get(item.familyId)} | ${queryForm.get(item.queryId)} | ${item.rank ?? '—'} | ${item.top1Hit ? 'yes' : 'no'} | ${item.top3Hit ? 'yes' : 'no'} | ${item.failureReason ?? '—'} |`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const families = await loadJson('pilot-families.json');
const queries = await loadJson('pilot-queries.json');
validatePilot({ families, queries });

const documents = await loadDocuments();
const corpusResourceIds = new Set(
  documents.map((document) => resourceIdFromBlobPath(document.blobPath)).filter(Boolean)
);
for (const family of families) {
  for (const resourceId of family.acceptableResourceIds) {
    if (!corpusResourceIds.has(resourceId)) {
      throw new Error(`Acceptable resource is absent from the evaluated corpus: ${resourceId}`);
    }
  }
}

function runPipeline(name, options) {
  const rankedByQuery = new Map();
  const rankings = {};
  for (const query of queries) {
    const ranked = rankKnowledgeDocuments(documents, runtimeInputFor(query), {
      limit: documents.length,
      ...options,
    });
    rankedByQuery.set(
      query.queryId,
      ranked.map(
        (document) => resourceIdFromBlobPath(document.blobPath) ?? `non-resource:${document.blobPath}`
      )
    );
    rankings[query.queryId] = ranked.slice(0, 3).map((document) => ({
      resourceId: resourceIdFromBlobPath(document.blobPath),
      blobPath: document.blobPath,
      score: document.score,
      compatibility: document.compatibility,
      documentType: document.metadata?.documentType,
    }));
  }
  return { name, ...scorePilot({ families, queries, rankedByQuery }), rankings };
}

const pipelines = [
  runPipeline('mixed-wiki-lexical-baseline', {}),
  runPipeline('resource-only-lexical', { documentType: 'resource' }),
  runPipeline('context-aware-resource-retrieval', { documentType: 'resource' }),
];
const result = pipelines[0];
const output = {
  generatedAt: new Date().toISOString(),
  corpusRoot,
  corpusDocuments: documents.length,
  pipelines,
  ...result,
};

await writeFile(
  path.join(retrievalRoot, 'pilot-results.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8'
);
await writeFile(
  path.join(retrievalRoot, 'pilot-results.md'),
  markdownReport(result, families, queries, documents.length),
  'utf8'
);

console.log(JSON.stringify(pipelines.map(({ name, summary }) => ({ name, summary }))));
