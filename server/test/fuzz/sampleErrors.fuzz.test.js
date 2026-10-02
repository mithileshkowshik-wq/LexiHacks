// Fuzzes the "Sample error updates" target from the robustness plan:
// PATCH /api/samples/:sampleId/errors/:errorIndex - invalid error index
// (-1, huge, string), invalid category, invalid confidence values, and
// malformed update bodies. Pass condition: invalid updates are rejected
// with a controlled 4xx, valid embedded error data is never corrupted, and
// nothing ever 500s.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import express from 'express';
import fc from 'fast-check';

import errorHandler from '../../middleware/errorHandler.js';
import { ERROR_CATEGORIES, Sample } from '../../models/sample.js';
import sampleRoutes from '../../routes/samples.js';

const NUM_RUNS = Number(process.env.FUZZ_RUNS ?? 500);
const SAMPLE_ID = '64b000000000000000000066';
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const originalMethods = { findById: Sample.findById };

// The single seeded error every property test starts from, so "valid data
// remains intact" has something concrete to check against.
function freshSample() {
  return {
    _id: SAMPLE_ID,
    student: '64b000000000000000000001',
    title: 'Seeded sample',
    taskType: 'ESSAY',
    pages: [{ imagePath: '/tmp/x.png', originalFilename: 'x.png' }],
    status: 'ANALYSED',
    illegibleNote: '',
    analysisError: '',
    analysedAt: null,
    createdAt: new Date(),
    errors: [
      {
        written: 'becos',
        intended: 'because',
        category: 'phonological',
        confidenceScore: 0.5,
        locationOnScan: null,
        note: '',
        dismissed: false,
      },
    ],
    save: async function save() {
      return this;
    },
  };
}

let sample;
let server;
let baseUrl;

before(() => {
  const app = express();
  app.use(express.json());
  app.use('/api/samples', sampleRoutes);
  app.use(errorHandler);
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  sample = freshSample();
  Sample.findById = async (id) => {
    if (!OBJECT_ID_RE.test(id)) {
      const error = new Error(`Cast to ObjectId failed for value "${id}"`);
      error.name = 'CastError';
      throw error;
    }
    return id === SAMPLE_ID ? sample : null;
  };
});

after(async () => {
  Sample.findById = originalMethods.findById;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

async function patch(errorIndex, body, sampleId = SAMPLE_ID) {
  const response = await fetch(
    `${baseUrl}/api/samples/${encodeURIComponent(sampleId)}/errors/${encodeURIComponent(String(errorIndex))}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch {
    // some failure paths may not produce JSON
  }
  return { response, body: responseBody };
}

function assertControlled(response, label) {
  assert.notEqual(response.status, 500, `${label} caused HTTP 500`);
  assert.ok(
    response.status >= 200 && response.status < 500,
    `${label} produced unexpected status ${response.status}`
  );
}

// A lone UTF-16 surrogate is a valid fc.string() output but makes
// encodeURIComponent throw in this test's own URL-building, not the server.
const encodable = (s) => {
  try {
    encodeURIComponent(s);
    return true;
  } catch {
    return false;
  }
};

describe('sample error index fuzzing', () => {
  test('random/malformed error indexes never 500 and never touch the errors array', async () => {
    const indexArb = fc.oneof(
      fc.integer(),
      fc.float(),
      fc.string({ maxLength: 50 }).filter(encodable),
      fc.constant('-1'),
      fc.constant('0'),
      fc.constant('1'),
      fc.constant('NaN'),
      fc.constant('Infinity'),
      fc.constant('1e300')
    );
    await fc.assert(
      fc.asyncProperty(indexArb, async (errorIndex) => {
        const before = JSON.stringify(sample.errors);
        const { response } = await patch(errorIndex, { dismissed: true });
        assertControlled(response, `errorIndex "${errorIndex}"`);
        // errorIndex 0 is the one real error and a legitimate dismissal -
        // everything else must leave the stored error untouched.
        if (String(errorIndex) !== '0') {
          assert.equal(JSON.stringify(sample.errors), before, 'invalid index must not mutate errors[]');
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('the reserved "new" index still appends a genuine educator-added error', async () => {
    const { response, body } = await patch('new', {
      written: 'freind',
      category: 'orthographic',
    });
    assert.equal(response.status, 200);
    assert.equal(body.errors.length, 2);
    assert.equal(body.errors[1].written, 'freind');
  });
});

describe('sample error field fuzzing', () => {
  test('random category values never 500 and invalid ones are rejected', async () => {
    const categoryArb = fc.oneof(
      fc.string({ maxLength: 100 }).filter(encodable),
      fc.constant(null),
      fc.constant(123),
      fc.array(fc.string()),
      fc.constantFrom(...ERROR_CATEGORIES)
    );
    await fc.assert(
      fc.asyncProperty(categoryArb, async (category) => {
        const { response } = await patch(0, { category });
        assertControlled(response, `category ${JSON.stringify(category)}`);
        if (!ERROR_CATEGORIES.includes(category)) {
          assert.notEqual(response.status, 200);
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('random confidenceScore values never 500 and out-of-range ones are rejected', async () => {
    const scoreArb = fc.oneof(
      fc.float({ noNaN: false }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.string({ maxLength: 20 }).filter(encodable),
      fc.constant(null),
      fc.constant(-1),
      fc.constant(2),
      fc.constant(0),
      fc.constant(1)
    );
    await fc.assert(
      fc.asyncProperty(scoreArb, async (confidenceScore) => {
        const { response } = await patch(0, { confidenceScore });
        assertControlled(response, `confidenceScore ${JSON.stringify(confidenceScore)}`);
        const valid =
          typeof confidenceScore === 'number' &&
          !Number.isNaN(confidenceScore) &&
          confidenceScore >= 0 &&
          confidenceScore <= 1;
        if (!valid) assert.notEqual(response.status, 200);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('random dismissed values never 500 and non-booleans are rejected', async () => {
    const dismissedArb = fc.oneof(
      fc.constant('yes'),
      fc.constant('true'),
      fc.constant(1),
      fc.constant(0),
      fc.constant(null),
      fc.string({ maxLength: 20 }).filter(encodable),
      fc.boolean()
    );
    await fc.assert(
      fc.asyncProperty(dismissedArb, async (dismissed) => {
        const { response } = await patch(0, { dismissed });
        assertControlled(response, `dismissed ${JSON.stringify(dismissed)}`);
        if (typeof dismissed !== 'boolean') assert.notEqual(response.status, 200);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('malformed/empty update bodies never 500', async () => {
    const bodyArb = fc.oneof(
      fc.constant({}),
      fc.constant({ unrelatedField: 'x' }),
      fc.dictionary(fc.string(), fc.anything(), { maxKeys: 5 }),
      fc.constant(null),
      fc.constant([])
    );
    await fc.assert(
      fc.asyncProperty(bodyArb, async (body) => {
        const { response } = await patch(0, body);
        assertControlled(response, `body ${JSON.stringify(body)}`);
      }),
      { numRuns: Math.min(NUM_RUNS, 200) }
    );
  });
});

describe('sample ID fuzzing on the same route', () => {
  test('random/malformed sampleId route params never 500', async () => {
    const sampleIdArb = fc.oneof(
      fc.string({ maxLength: 200 }).filter(encodable),
      fc.constant(''),
      fc.constant('000000000000000000000000'),
      fc
        .array(fc.constantFrom(..."0123456789abcdef".split('')), { minLength: 24, maxLength: 24 })
        .map((chars) => chars.join(''))
    );
    await fc.assert(
      fc.asyncProperty(sampleIdArb, async (sampleId) => {
        const { response } = await patch(0, { dismissed: true }, sampleId || 'x');
        assertControlled(response, `sampleId "${sampleId}"`);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('a genuinely valid update still succeeds after all this fuzzing', async () => {
    const { response, body } = await patch(0, { category: 'orthographic' });
    assert.equal(response.status, 200);
    assert.equal(body.errors[0].category, 'orthographic');
  });
});
