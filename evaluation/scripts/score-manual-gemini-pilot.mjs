import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

const PACKETS =
  'evaluation/retrieval/manual-pilot-packets.json';

const RESPONSES =
  'evaluation/retrieval/manual-responses';

const OUTPUT =
  'evaluation/retrieval/manual-gemini-results.json';

function parseGeminiResponse(
  raw,
) {
  let cleaned =
    raw.trim();

  cleaned =
    cleaned.replace(
      /^```json\s*/i,
      '',
    );

  cleaned =
    cleaned.replace(
      /^```\s*/i,
      '',
    );

  cleaned =
    cleaned.replace(
      /\s*```$/,
      '',
    );

  return JSON.parse(
    cleaned.trim(),
  );
}

const packets =
  JSON.parse(
    await readFile(
      PACKETS,
      'utf8',
    ),
  );

let candidateRetentionHits = 0;
let completed = 0;
let top1Hits = 0;
let top3Hits = 0;

const results = [];

for (
  const packet
  of packets
) {
  const acceptable =
    new Set(
      packet.acceptableResourceIds,
    );

  const candidateIds =
    packet.candidates.map(
      (candidate) =>
        candidate.resourceId,
    );

  const candidateSet =
    new Set(
      candidateIds,
    );

  const acceptableCandidatePositions =
    candidateIds
      .map(
        (
          resourceId,
          index,
        ) =>
          acceptable.has(
            resourceId,
          )
            ? index + 1
            : null,
      )
      .filter(
        (position) =>
          position !== null,
      );

  const candidateRetained =
    acceptableCandidatePositions
      .length > 0;

  if (
    candidateRetained
  ) {
    candidateRetentionHits++;
  }

  const responsePath =
    path.join(
      RESPONSES,
      `${packet.caseId}.txt`,
    );

  let parsed;

  try {
    const raw =
      await readFile(
        responsePath,
        'utf8',
      );

    parsed =
      parseGeminiResponse(
        raw,
      );
  } catch (error) {
    results.push({
      caseId:
        packet.caseId,

      familyId:
        packet.familyId,

      status:
        'MISSING_OR_INVALID_RESPONSE',

      candidateRetained,

      acceptableCandidatePositions,

      error:
        error.message,
    });

    continue;
  }

  completed++;

  const rawSelections =
    Array.isArray(
      parsed.selections,
    )
      ? parsed.selections
      : [];

  const selectedIds =
    rawSelections
      .map(
        (selection) =>
          selection.resourceId,
      )
      .filter(Boolean)
      .slice(0, 3);

  /*
   * Validate closed candidate set.
   */

  const invalidSelections =
    selectedIds.filter(
      (resourceId) =>
        !candidateSet.has(
          resourceId,
        ),
    );

  const validSelections =
    selectedIds.filter(
      (resourceId) =>
        candidateSet.has(
          resourceId,
        ),
    );

  const top1 =
    validSelections.length > 0 &&
    acceptable.has(
      validSelections[0],
    );

  const top3 =
    validSelections.some(
      (resourceId) =>
        acceptable.has(
          resourceId,
        ),
    );

  if (top1) {
    top1Hits++;
  }

  if (top3) {
    top3Hits++;
  }

  results.push({
    caseId:
      packet.caseId,

    familyId:
      packet.familyId,

    status:
      invalidSelections.length > 0
        ? 'INVALID_SELECTION'
        : 'OK',

    candidateRetained,

    acceptableCandidatePositions,

    selectedIds:
      validSelections,

    invalidSelections,

    top1,

    top3,

    selections:
      rawSelections,
  });
}

const summary = {
  totalCases:
    packets.length,

  completed,

  candidateRetention: {
    hits:
      candidateRetentionHits,

    total:
      packets.length,

    percentage:
      packets.length > 0
        ? (
            (candidateRetentionHits /
              packets.length) *
            100
          ).toFixed(1)
        : '0.0',
  },

  geminiTop1: {
    hits:
      top1Hits,

    total:
      completed,

    percentage:
      completed > 0
        ? (
            (top1Hits /
              completed) *
            100
          ).toFixed(1)
        : '0.0',
  },

  geminiTop3: {
    hits:
      top3Hits,

    total:
      completed,

    percentage:
      completed > 0
        ? (
            (top3Hits /
              completed) *
            100
          ).toFixed(1)
        : '0.0',
  },
};

const output = {
  generatedAt:
    new Date()
      .toISOString(),

  summary,

  results,
};

await writeFile(
  OUTPUT,
  `${JSON.stringify(
    output,
    null,
    2,
  )}\n`,
  'utf8',
);

console.log('');
console.log(
  '================================',
);
console.log(
  'MANUAL GEMINI RETRIEVAL PILOT',
);
console.log(
  '================================',
);
console.log('');

console.log(
  `Candidate retention: ${candidateRetentionHits}/${packets.length} (${summary.candidateRetention.percentage}%)`,
);

console.log(
  `Gemini Top-1: ${top1Hits}/${completed} (${summary.geminiTop1.percentage}%)`,
);

console.log(
  `Gemini Top-3: ${top3Hits}/${completed} (${summary.geminiTop3.percentage}%)`,
);

console.log('');
console.log(
  'CASE RESULTS',
);
console.log(
  '--------------------------------',
);

for (
  const result
  of results
) {
  console.log(
    `${result.caseId}`,
  );

  console.log(
    `  acceptable candidate positions: ${JSON.stringify(
      result.acceptableCandidatePositions,
    )}`,
  );

  console.log(
    `  selected: ${JSON.stringify(
      result.selectedIds ?? [],
    )}`,
  );

  console.log(
    `  Top-1: ${result.top1 ?? '-'}`,
  );

  console.log(
    `  Top-3: ${result.top3 ?? '-'}`,
  );

  console.log(
    `  status: ${result.status}`,
  );

  console.log('');
}

console.log(
  `Saved results to ${OUTPUT}`,
);