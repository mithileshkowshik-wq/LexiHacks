import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const serverDirectory = fileURLToPath(new URL('..', import.meta.url));
process.chdir(serverDirectory);
dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });

if (process.env.RUN_LIVE_DEMO !== 'true') {
  throw new Error('Live demo server requires RUN_LIVE_DEMO=true.');
}
if (!process.env.GEMINI_API_KEY) {
  throw new Error('Live demo requires GEMINI_API_KEY in the ignored server/.env file.');
}

process.env.NODE_ENV = 'test';
process.env.USE_MOCK_AI = 'false';
process.env.RECOMMENDATION_USE_MOCKS = 'false';
process.env.WORKSHEET_SECTIONS_PATH = path.join(
  serverDirectory,
  'data',
  'worksheetSections.live.json'
);
process.env.JWT_SECRET = 'lexipath-live-demo-ephemeral-secret';

const STUDENT_ID = new mongoose.Types.ObjectId('64b000000000000000000201');
const username = 'LiveDemo@DAS';
const password = 'LiveDemo@123';
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());

const [{ default: app }, { Account }, { Sample }, { Student }] = await Promise.all([
  import('../app.js'),
  import('../models/account.js'),
  import('../models/sample.js'),
  import('../models/student.js'),
]);

const uploadDirectory = path.join(serverDirectory, 'samples', String(STUDENT_ID));

await Account.create({
  username,
  email: 'live-demo@example.invalid',
  passwordHash: await bcrypt.hash(password, 4),
  name: 'Live Demo Educator',
  role: 'Educator',
  organisation: 'Ephemeral Test School',
});
await Student.create({
  _id: STUDENT_ID,
  name: 'Live Demo Learner',
  currentGrade: 'Primary 4',
});
await Sample.create({
  student: STUDENT_ID,
  title: 'Earlier synthetic writing',
  taskType: 'ESSAY',
  pages: [{ imagePath: '/tmp/lexipath-live-demo-history.png', originalFilename: 'history.png' }],
  status: 'ANALYSED',
  errors: [
    {
      written: 'becos',
      intended: 'because',
      category: 'phonological',
      confidenceScore: 0.9,
      locationOnScan: { page: 0, x: 0.1, y: 0.1, z: 0.2, w: 0.1 },
    },
  ],
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});

const port = Number(process.env.PORT) || 5001;
const server = http.createServer(async (req, res) => {
  if (
    req.method === 'DELETE' &&
    req.url === '/api/live-demo/cleanup' &&
    req.headers['x-live-demo-cleanup'] === process.env.JWT_SECRET
  ) {
    await fs.rm(uploadDirectory, { recursive: true, force: true });
    res.writeHead(204).end();
    return;
  }
  app(req, res);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`LexiPath live-demo API ready on http://127.0.0.1:${port}`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
  await fs.rm(uploadDirectory, { recursive: true, force: true });
}

process.once('SIGTERM', () => stop().finally(() => process.exit(0)));
process.once('SIGINT', () => stop().finally(() => process.exit(0)));