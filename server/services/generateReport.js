import { AppError } from '../utils/appError.js';
import { recommendationEngine } from './recommendationEngine.js';
import { buildRecommendationContext } from './studentContext.js';

const ANALYSED_STATUSES = new Set(['ANALYSED', 'REVIEWED']);

// Build one latest-only intervention report from every usable student sample.
export async function generateReport(student, samples, engine = recommendationEngine) {
  const analysed = samples.filter((sample) => ANALYSED_STATUSES.has(sample.status));
  const errors = analysed.flatMap((sample, sampleIndex) =>
    (sample.errors ?? [])
      .filter((error) => !error.dismissed)
      .map((error, index) => ({
        id: `error-${sampleIndex + 1}-${index + 1}`,
        sampleId: sample._id.toString(),
        written: error.written,
        intended: error.intended ?? '',
        category: error.category ?? 'unsure',
        note: error.note ?? '',
      }))
  );

  if (errors.length === 0) {
    throw new AppError(
      422,
      'NO_ACTIVE_ERRORS',
      'No active errors were found in this student’s analysed samples.'
    );
  }

  const strategies = await engine.createInterventionStrategies(
    buildRecommendationContext(student, errors),
    4
  );
  return {
    basedOnSamples: analysed.map((sample) => sample._id),
    strategies: strategies.slice(0, 4),
  };
}
