import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

import errorHandler from './middleware/errorHandler.js';
import requireAuth from './middleware/requireAuth.js';
import auth from './routes/auth.js';
import recommendation from './routes/recommendation.js';
import samples from './routes/samples.js';
import students from './routes/students.js';
import worksheets from './routes/worksheets.js';
import { AppError } from './utils/appError.js';

// The single Express app definition — server.js just connects to the
// database and calls app.listen() on this. Keeping route mounting and the
// 404 catch-all in one place means the two can no longer drift apart, the
// way app.js and server.js each independently ended up doing before.
const app = express();
const publicDirectory = fileURLToPath(new URL('./public', import.meta.url));
const frontendEntry = path.join(publicDirectory, 'index.html');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
// Cloud Run probes readiness without a login or any student information.
// /api/health also works through the public Cloud Run gateway.
app.get(['/healthz', '/api/health'], (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
});
// /api/auth is the one router that must stay reachable without a token —
// everything else requires the caller to have already signed in.
app.use('/api/samples', requireAuth, samples);
app.use('/api/students', requireAuth, students);
app.use('/api/worksheets', requireAuth, worksheets);
app.use('/api/recommendation', requireAuth, recommendation);
app.use('/api/auth', auth);
app.use('/api', (req, res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'));
});

app.use(express.static(publicDirectory));
app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  res.sendFile(frontendEntry, (error) => {
    if (error) next(error);
  });
});

app.use((req, res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'));
});
app.use(errorHandler);

export default app;
