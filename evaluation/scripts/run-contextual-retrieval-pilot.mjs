import { readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rankKnowledgeDocuments } from '../../server/services/recommendationEngine.js';
import { resourceIdFromBlobPath, scorePilot } from '../lib/retrievalPilot.mjs';

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

const cases = [
  {
    familyId: 'long-o-band-b-secondary-y1t1w4',
    label: 'Long-o spelling, SLP Band B Secondary Y1T1W4',
    acceptableResourceIds: ['das-src-0447-part-1-phonics-review-of-long-o-o-e-oa-ow'],
    queries: [
      {
        queryId: 'long-o-context-1',
        input: {
          programme: 'SLP',
          band: 'B',
          level: 'secondary',
          programmeYear: 1,
          term: 1,
          week: 4,
          errors: [{ id: 'e1', category: 'phonological', written: 'bote', intended: 'boat', note: 'long o oa ow spelling pattern' }],
        },
      },
    ],
  },
  {
    familyId: 'vccv-band-b-primary-y1t1w4',
    label: 'VC|CV syllabication, SLP Band B Primary Y1T1W4',
    acceptableResourceIds: [
      'das-src-0286-band-b-y1t1w5-reading-and-spelling',
      'das-src-0390-band-b-y1t1w5-reading-and-spelling',
    ],
    queries: [
      {
        queryId: 'vccv-context-1',
        input: {
          programme: 'SLP',
          band: 'B',
          level: 'primary',
          programmeYear: 1,
          term: 1,
          week: 4,
          errors: [{ id: 'e1', category: 'phonological', written: 'hapened', intended: 'happened', note: 'needs VC CV syllable division between consonants' }],
        },
      },
    ],
  },
];

const families = cases.map(({ familyId, label, acceptableResourceIds }) => ({
  familyId,
  label,
  acceptableResourceIds,
}));
const queries = cases.flatMap((item) => item.queries.map((query) => ({ ...query, familyId: item.familyId })));
const documents = await loadDocuments();
const rankedByQuery = new Map();
const rankings = {};
for (const query of queries) {
  const ranked = rankKnowledgeDocuments(documents, query.input, {
    documentType: 'resource',
    limit: documents.length,
  });
  rankedByQuery.set(
    query.queryId,
    ranked.map((document) => resourceIdFromBlobPath(document.blobPath) ?? `non-resource:${document.blobPath}`)
  );
  rankings[query.queryId] = ranked.slice(0, 5).map((document) => ({
    resourceId: resourceIdFromBlobPath(document.blobPath),
    blobPath: document.blobPath,
    score: document.score,
    compatibility: document.compatibility,
    metadata: document.metadata,
  }));
}
const result = scorePilot({ families, queries, rankedByQuery });
const output = {
  generatedAt: new Date().toISOString(),
  corpusRoot,
  corpusDocuments: documents.length,
  summary: result.summary,
  queries: result.queries,
  rankings,
};
await writeFile(
  path.join(retrievalRoot, 'contextual-pilot-results.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify(result.summary));
