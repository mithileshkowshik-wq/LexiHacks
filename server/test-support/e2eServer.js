import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.USE_MOCK_AI = 'true';
process.env.RECOMMENDATION_USE_MOCKS = 'true';
process.env.JWT_SECRET = 'lexipath-e2e-test-secret';
delete process.env.RESEND_API_KEY;

const STUDENT_ID = new mongoose.Types.ObjectId('64b000000000000000000001');
const SAMPLE_ID = new mongoose.Types.ObjectId('64b000000000000000000101');
const SECOND_SAMPLE_ID = new mongoose.Types.ObjectId('64b000000000000000000102');

const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());

const [{ default: app }, { Account }, { RecommendationReport }, { Sample }, { Student }] =
  await Promise.all([
    import('../app.js'),
    import('../models/account.js'),
    import('../models/recommendationReport.js'),
    import('../models/sample.js'),
    import('../models/student.js'),
  ]);

await Student.create({
  _id: STUDENT_ID,
  name: 'Synthetic Learner',
  currentGrade: 'Primary 4',
});

const sharedError = {
  written: 'becos',
  intended: 'because',
  category: 'phonological',
  confidenceScore: 0.5,
  dismissed: false,
  locationOnScan: { page: 0, x: 0.1, y: 0.1, z: 0.25, w: 0.1 },
};

await Sample.create([
  {
    _id: SAMPLE_ID,
    student: STUDENT_ID,
    title: 'Synthetic writing one',
    taskType: 'ESSAY',
    pages: [{ imagePath: '/tmp/lexipath-e2e.png', originalFilename: 'synthetic.png' }],
    status: 'ANALYSED',
    errors: [sharedError],
    createdAt: new Date('2026-06-01T00:00:00Z'),
  },
  {
    _id: SECOND_SAMPLE_ID,
    student: STUDENT_ID,
    title: 'Synthetic writing two',
    taskType: 'ESSAY',
    pages: [{ imagePath: '/tmp/lexipath-e2e-2.png', originalFilename: 'synthetic-2.png' }],
    status: 'REVIEWED',
    errors: [{ ...sharedError, written: 'frend', confidenceScore: 0.9 }],
    createdAt: new Date('2026-07-01T00:00:00Z'),
  },
]);

await RecommendationReport.create({
  student: STUDENT_ID,
  basedOnSamples: [SAMPLE_ID, SECOND_SAMPLE_ID],
  strategies: [
    {
      strategy: 'Practise sound-to-letter mapping',
      rationale: 'Two synthetic samples show phonological errors.',
      targetCategories: ['phonological'],
      evidence: [{ category: 'phonological', count: 2, writtenExamples: ['becos', 'frend'] }],
      worksheets: [],
    },
  ],
});

await Account.create({
  username: 'Synthetic@DAS',
  email: 'synthetic@example.invalid',
  passwordHash: await bcrypt.hash('Pass@123', 4),
  name: 'Synthetic Educator',
  role: 'Educator',
  organisation: 'Synthetic School',
  resetToken: 'e2e-reset-token',
  resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
});

// Listen on both IPv4 and IPv6 because Vite's proxy target uses `localhost`
// while Playwright's readiness probe intentionally uses 127.0.0.1.
const server = app.listen(5000, () => {
  console.log('LexiPath E2E API ready on http://127.0.0.1:5000');
});

async function stop() {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}

process.once('SIGTERM', stop);
process.once('SIGINT', stop);
