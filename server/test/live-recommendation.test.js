import assert from 'node:assert/strict';
import test from 'node:test';

import { RecommendationEngine } from '../services/recommendationEngine.js';

const RUN_LIVE = process.env.RUN_LIVE_RECOMMENDATION_TESTS === 'true';
const liveTest = RUN_LIVE ? test : test.skip;

// Read only enough of the streamed response to prove the approved Azure asset is a PDF.
async function readPdfSignature(response) {
  assert.ok(response.body, 'Azure must return a response body');
  const reader = response.body.getReader();
  const bytes = [];
  let length = 0;
  try {
    while (length < 5) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes.push(value);
      length += value.length;
    }
  } finally {
    await reader.cancel();
  }
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of bytes) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(combined.subarray(0, 5));
}

liveTest(
  'live Azure context -> Gemini strategies -> approved worksheet PDF',
  {
    timeout: 300_000,
  },
  async (t) => {
    assert.ok(
      process.env.GEMINI_RECOMMENDATION_API_KEY || process.env.GEMINI_API_KEY,
      'A Gemini API key must be configured in server/.env'
    );
    for (const name of [
      'AZURE_STORAGE_ACCOUNT_NAME',
      'AZURE_STORAGE_CONTAINER_NAME',
      'AZURE_STORAGE_SAS_TOKEN',
    ]) {
      assert.ok(process.env[name], `${name} must be configured in server/.env`);
    }

    const engine = new RecommendationEngine({ useMocks: false });
    const status = engine.getStatus();
    assert.equal(status.mode, 'gemini');
    assert.equal(status.azureConfigured, true);
    assert.equal(status.knowledgeSourceConfigured, true);

    // Synthetic evidence exercises retrieval without exposing a real student's writing.
    const strategies = await engine.createInterventionStrategies({
      level: 'primary',
      errors: [
        {
          id: 'live-error-1',
          category: 'phonological',
          written: 'pali',
          intended: 'pale',
          note: 'long-vowel and silent-e confusion',
        },
      ],
    });

    assert.ok(strategies.length > 0, 'Gemini must return at least one strategy');
    assert.ok(strategies[0].strategy, 'The strategy must have a title');
    assert.ok(strategies[0].rationale, 'The strategy must have a rationale');

    const worksheets = strategies.flatMap((strategy) => strategy.worksheets ?? []);
    assert.ok(worksheets.length > 0, 'Gemini must attach an approved worksheet');
    const worksheet = worksheets[0];
    assert.ok(worksheet.worksheetId, 'The worksheet must have a stable ID');
    assert.ok(worksheet.pdfPath.endsWith('.pdf'), 'The approved asset must be a PDF');

    const { response } = await engine.fetchWorksheet(worksheet.worksheetId);
    assert.equal(response.ok, true, 'Azure must return the approved worksheet');
    assert.match(
      response.headers.get('content-type') ?? '',
      /application\/pdf|application\/octet-stream/i,
      'Azure must identify the worksheet as PDF or binary content'
    );
    assert.equal(
      await readPdfSignature(response),
      '%PDF-',
      'The Azure asset must contain PDF bytes'
    );

    t.diagnostic(
      JSON.stringify({
        mode: status.mode,
        model: status.model,
        strategies: strategies.length,
        worksheetId: worksheet.worksheetId,
        azurePdfVerified: true,
      })
    );
  }
);
