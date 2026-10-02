import { AppError } from '../utils/appError.js';
import { recommendationEngine } from './recommendationEngine.js';
import { buildRecommendationContext } from './studentContext.js';

const ANALYSED_STATUSES = new Set(['ANALYSED', 'REVIEWED']);

// Convert non-dismissed errors into reviewed evidence with ephemeral prompt IDs.
function activeErrors(sample) {
  return (sample.errors ?? [])
    .filter((error) => !error.dismissed)
    .map((error, index) => ({
      id: `error-${index + 1}`,
      written: error.written,
      intended: error.intended ?? '',
      category: error.category ?? 'unsure',
      note: error.note ?? '',
    }));
}

// Validate an analysed sample and return no more than three grounded worksheets.
export async function recommendWorksheets(sample, engine = recommendationEngine) {
  if (!ANALYSED_STATUSES.has(sample.status)) {
    throw new AppError(
      422,
      'SAMPLE_NOT_ANALYSED',
      'Worksheets can only be generated for an analysed sample.'
    );
  }
  const errors = activeErrors(sample);
  if (errors.length === 0) {
    throw new AppError(422, 'NO_ACTIVE_ERRORS', 'This sample has no active errors.');
  }
  const worksheets = await engine.findWorksheets(
    buildRecommendationContext(sample.student, errors),
    3
  );
  return worksheets.slice(0, 3);
}
