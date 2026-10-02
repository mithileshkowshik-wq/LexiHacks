import {
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  filterCandidateResources,
  rankKnowledgeDocuments,
} from '../../server/services/recommendationEngine.js';

import {
  resourceIdFromBlobPath,
} from '../lib/retrievalPilot.mjs';

/*
 * Paths
 */

const evaluationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const retrievalRoot = path.join(
  evaluationRoot,
  'retrieval',
);

const vaultRoot = path.resolve(
  process.env.KNOWLEDGE_VAULT_PATH ??
    path.join(os.homedir(), 'KnowledgeVault'),
);

const corpusRoot = path.join(
  vaultRoot,
  '_deploy',
  'azure-knowledge-vault',
);

/*
 * Helpers
 */

function normalise(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [value];
}

async function loadDocuments() {
  const wikiRoot = path.join(
    corpusRoot,
    'wiki',
  );

  const entries = await readdir(
    wikiRoot,
    {
      recursive: true,
      withFileTypes: true,
    },
  );

  const markdownPaths = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name
          .toLowerCase()
          .endsWith('.md'),
    )
    .map((entry) =>
      path.join(
        entry.parentPath,
        entry.name,
      ),
    )
    .sort();

  return Promise.all(
    markdownPaths.map(
      async (filePath) => {
        const blobPath = path
          .relative(
            corpusRoot,
            filePath,
          )
          .split(path.sep)
          .join('/');

        const content =
          await readFile(
            filePath,
            'utf8',
          );

        return {
          blobPath,
          content,
          searchText: normalise(
            `${blobPath} ${content}`,
          ),
        };
      },
    ),
  );
}

function candidateForPrompt(document) {
  const metadata =
    document.metadata ?? {};

  return {
    resourceId:
      metadata.resourceId ??
      resourceIdFromBlobPath(
        document.blobPath,
      ),

    title:
      metadata.title ??
      document.title ??
      document.blobPath,

    programme:
      metadata.programme ?? null,

    band:
      metadata.band ?? null,

    level:
      metadata.level ?? null,

    year:
      metadata.year ?? null,

    term:
      metadata.term ?? null,

    week:
      metadata.week ?? null,

    resourceType:
      metadata.resourceType ?? null,

    targetSkills:
      Array.isArray(
        metadata.targetSkills,
      )
        ? metadata.targetSkills
        : [],

    addressesErrorTypes:
      Array.isArray(
        metadata.addressesErrorTypes,
      )
        ? metadata.addressesErrorTypes
        : [],

    description:
      metadata.summary ?? '',
  };
}

function knowledgeForPrompt(
  document,
) {
  const metadata =
    document.metadata ?? {};

  return {
    title:
      metadata.title ??
      document.title ??
      document.blobPath,

    blobPath:
      document.blobPath,

    content: String(
      document.content ?? '',
    ).slice(0, 2500),
  };
}

/*
 * Main
 */

await mkdir(
  retrievalRoot,
  {
    recursive: true,
  },
);

const cases = JSON.parse(
  await readFile(
    path.join(
      retrievalRoot,
      'manual-gemini-cases.json',
    ),
    'utf8',
  ),
);

const documents =
  await loadDocuments();

console.log(
  `Loaded ${documents.length} KnowledgeVault documents`,
);

const packets = [];

for (
  const testCase
  of cases
) {
  const input = {
    programme:
      testCase.studentContext
        .programme ?? null,

    band:
      testCase.studentContext
        .band ?? null,

    level:
      testCase.studentContext
        .level ?? null,

    programmeYear:
      testCase.studentContext
        .programmeYear ?? null,

    term:
      testCase.studentContext
        .term ?? null,

    week:
      testCase.studentContext
        .week ?? null,

    errors:
      testCase.errors,
  };

  /*
   * RESOURCE branch
   *
   * Uses the same production ranker
   * with documentType=resource.
   *
   * We request more than 25 first,
   * remove anything without a stable
   * resource ID, then keep 25.
   */

 const filteredResources =
  filterCandidateResources(
    documents,
    input,
    25,
  );

const candidates =
  filteredResources
    .map(candidateForPrompt)
    .filter(
      (candidate) =>
        Boolean(candidate.resourceId),
    );

  /*
   * TEACHER KNOWLEDGE branch
   */

  const rankedKnowledge =
    rankKnowledgeDocuments(
      documents,
      input,
      {
        documentType:
          'teacher_knowledge',

        limit: 20,
      },
    );

  /*
   * Keep DAS instructional knowledge.
   *
   * This avoids using generic
   * repository documentation such as
   * ARCHITECTURE.md as "teacher
   * knowledge".
   */

  let teacherKnowledge =
    rankedKnowledge
      .filter((document) =>
        document.blobPath.includes(
          'wiki/projects/das-learning-resources/',
        ),
      )
      .filter(
        (document) =>
          !document.blobPath.includes(
            '/resources/',
          ),
      )
      .slice(0, 6)
      .map(
        knowledgeForPrompt,
      );

  /*
   * Fallback in case there are fewer
   * than 6 matching DAS knowledge docs.
   */

  if (
    teacherKnowledge.length === 0
  ) {
    teacherKnowledge =
      rankedKnowledge
        .slice(0, 6)
        .map(
          knowledgeForPrompt,
        );
  }

  const candidateIds =
    candidates.map(
      (candidate) =>
        candidate.resourceId,
    );

  const acceptableSet =
    new Set(
      testCase
        .acceptableResourceIds,
    );

  const acceptablePositions =
    candidateIds
      .map(
        (resourceId, index) =>
          acceptableSet.has(
            resourceId,
          )
            ? index + 1
            : null,
      )
      .filter(
        (value) =>
          value !== null,
      );

  packets.push({
    caseId:
      testCase.caseId,

    familyId:
      testCase.familyId,

    studentContext:
      testCase.studentContext,

    errors:
      testCase.errors,

    /*
     * EVALUATOR ONLY.
     *
     * The prompt-generator MUST NOT
     * send this field to Gemini.
     */

    acceptableResourceIds:
      testCase
        .acceptableResourceIds,

    acceptableCandidatePositions:
      acceptablePositions,

    candidateRetained:
      acceptablePositions
        .length > 0,

    candidates,

    teacherKnowledge,
  });

  console.log(
    `${testCase.caseId}: ` +
      `candidates=${candidates.length}, ` +
      `acceptable positions=${JSON.stringify(
        acceptablePositions,
      )}`,
  );
}

const outputPath =
  path.join(
    retrievalRoot,
    'manual-pilot-packets.json',
  );

await writeFile(
  outputPath,
  `${JSON.stringify(
    packets,
    null,
    2,
  )}\n`,
  'utf8',
);

console.log('');
console.log(
  `Saved ${outputPath}`,
);