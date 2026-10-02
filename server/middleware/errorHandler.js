import constants from '../constants.js';

// Titles for the { title, message, stackTrace } envelope every route in the
// app already answers with (see client/src/lib/api.js and the existing
// integration tests, both of which read this exact shape).
const TITLES = {
  [constants.VALIDATION_ERROR]: 'Validation error',
  [constants.NOT_FOUND]: 'Not found',
  [constants.FORBIDDEN]: 'Forbidden',
  [constants.UNAUTHORIZED]: 'Unauthorized',
  [constants.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
  [constants.INTERNAL_SERVER_ERROR]: 'Internal server error',
};

const errorHandler = (err, req, res, next) => {
  // Combined in from feat/recommendation-engine-integration: a response
  // already in flight (e.g. a stream) can't be re-sent - hand off to
  // Express's default handler instead of throwing "headers already sent".
  if (res.headersSent) return next(err);

  // AppError (server/utils/appError.js) sets statusCode/code on the error
  // instance itself and doesn't call res.status() first, so it must be
  // checked before falling back to whatever res.statusCode already is.
  let statusCode = err.statusCode ?? (res.statusCode >= 400 ? res.statusCode : constants.INTERNAL_SERVER_ERROR);

  // Also combined in: Mongoose throws these by name rather than setting
  // res.statusCode itself, so map them here instead of every route
  // remembering to catch and re-throw with the right status.
  if (err.name === 'ValidationError') {
    statusCode = constants.VALIDATION_ERROR;
  } else if (err.name === 'CastError') {
    statusCode = constants.VALIDATION_ERROR;
    err = new Error('The supplied resource ID is invalid.');
  }

  // constants only names the handful of statuses the legacy title map
  // covers; AppError also throws 502s with its own machine-readable code,
  // so title falls back gracefully and code defaults from that title.
  const title = TITLES[statusCode] ?? TITLES[constants.INTERNAL_SERVER_ERROR] ?? 'Error';
  const code = err.code ?? title.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  let message = err.message;
  const exposeInternals = process.env.NODE_ENV !== 'production';

  if (statusCode >= 500) {
    console.error(`[${title}]`, err);
    if (!exposeInternals) {
      message = 'An unexpected server error occurred.';
    }
  }

  // Two envelope shapes are in active use across the app: the legacy
  // { title, message, stackTrace } read by client/src/lib/api.js and most
  // existing tests, and the newer { error: { code, message } } read by the
  // AppError-based recommendation routes/tests. Send both in one body so
  // neither consumer needs to change. stackTrace is dev-only - it must
  // never leak internals (file paths, function names) to a production client.
  res.status(statusCode).json({
    title,
    message,
    stackTrace: exposeInternals ? err.stack : undefined,
    error: { code, message },
  });
};

export default errorHandler;
