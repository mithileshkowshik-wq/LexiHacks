import { Student } from '../models/student.js';
import { Sample, ERROR_CATEGORIES } from '../models/sample.js';
import { hasPlacement, placementFromBody } from '../services/studentContext.js';
// The client shape for a student. Every route in this file answers with
// this instead of the raw Mongoose document, so `_id`/`__v` never reach the
// UI — client/src/lib/api.js and the pages key off `studentId`.
const toClientStudent = (s) => ({
  studentId: s._id,
  name: s.name,
  currentGrade: s.currentGrade,
  ...(hasPlacement(s) && {
    programme: s.programme ?? null,
    band: s.band ?? null,
    programmeYear: s.programmeYear ?? null,
    term: s.term ?? null,
    week: s.week ?? null,
  }),
  ...(s.teacherId && { teacherId: s.teacherId }),
});

const parseDateQuery = (value) => {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof value !== 'string' || !dateFormat.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // JavaScript changes impossible dates such as 2026-02-30 into a date in
  // March. Comparing each part lets us reject that instead of accepting it.
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isRealDate ? date : null;
};

function assertPlacementIsValid({ programme, band, programmeYear, term, week }) {
  if (programme && !['SLP', 'ELL-MLP'].includes(programme)) {
    throw new Error('Programme must be SLP or ELL-MLP.');
  }
  if (band && !['A', 'B', 'C'].includes(band)) {
    throw new Error('Band must be A, B, or C.');
  }
  if (programmeYear !== null && (programmeYear < 1 || programmeYear > 6)) {
    throw new Error('Programme year must be between 1 and 6.');
  }
  if (term !== null && (term < 1 || term > 4)) {
    throw new Error('Term must be between 1 and 4.');
  }
  if (week !== null && (week < 1 || week > 20)) {
    throw new Error('Week must be between 1 and 20.');
  }
}

// Newest first, matching StudentsListPage, which drops a newly created
// student at the top of the grid.
//
// Deliberately unscoped: with no auth (see server/README.md's
// "Authentication" section) this returns every student in the database,
// not just the signed-in teacher's caseload. A known prototype cut, not a
// bug - see paths.txt.
const getStudents = async (req, res) => {
  // Older development databases can contain documents from before these
  // required fields existed. Do not let one unusable legacy row crash the
  // entire caseload screen.
  const students = await Student.find({
    name: { $type: 'string' },
    currentGrade: { $type: 'string' },
  }).sort({ createdAt: -1 });
  res.json(students.map(toClientStudent));
};

const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  res.status(200).json(toClientStudent(student));
};

const createStudent = async (req, res) => {
  const { name, currentGrade, teacherId } = req.body;
  if (!name || !currentGrade) {
    res.status(400);
    throw new Error('All fields are mandatory!');
  }
  const placement = placementFromBody(req.body);
  res.status(400);
  assertPlacementIsValid(placement);
  const student = await Student.create({
    name,
    currentGrade,
    ...placement,
    ...(teacherId && { teacherId }),
  });
  res.status(201).json(toClientStudent(student));
};

// Computed on demand from stored Samples - there is no persisted trend
// entity, by design (see the Error Trends & Analytics slice notes).
// Combines aadi/main's date-range filtering with error_trends_kavi's
// richer aggregate shape (totalSamples/mostFrequentCategory/categoryTotals
// plus a per-sample trends[] series), and adds the two filter rules the
// spec calls for: only ANALYSED/REVIEWED samples contribute, and dismissed
// errors are excluded from every count.
const getTrends = async (req, res) => {
  const student = await Student.findById(req.params.studentId).catch(() => null);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const filter = { student: req.params.studentId, status: { $in: ['ANALYSED', 'REVIEWED'] } };
  let fromDate = null;
  if (req.query.from) {
    fromDate = parseDateQuery(req.query.from);
    if (!fromDate) {
      res.status(400);
      throw new Error('The "from" date must use the YYYY-MM-DD format');
    }
    filter.createdAt = { $gte: fromDate };
  }
  if (req.query.to) {
    const toDate = parseDateQuery(req.query.to);
    if (!toDate) {
      res.status(400);
      throw new Error('The "to" date must use the YYYY-MM-DD format');
    }
    if (fromDate && fromDate > toDate) {
      res.status(400);
      throw new Error('The "from" date must not be later than the "to" date');
    }
    // Use midnight of the following UTC day as the exclusive upper limit.
    // For to=2026-07-27, this produces createdAt < 2026-07-28 00:00 UTC.
    toDate.setUTCDate(toDate.getUTCDate() + 1);
    filter.createdAt = { ...filter.createdAt, $lt: toDate };
  }

  const samples = await Sample.find(filter).sort({ createdAt: 1 });

  const categoryTotals = Object.fromEntries(ERROR_CATEGORIES.map((category) => [category, 0]));
  let totalErrors = 0;

  const trends = samples.map((sample) => {
    const categoryCounts = Object.fromEntries(ERROR_CATEGORIES.map((category) => [category, 0]));
    const validErrors = sample.errors.filter((error) => !error.dismissed);

    for (const error of validErrors) {
      categoryCounts[error.category] += 1;
      categoryTotals[error.category] += 1;
    }
    totalErrors += validErrors.length;

    return {
      sampleId: sample._id,
      title: sample.title,
      date: sample.createdAt,
      totalErrors: validErrors.length,
      categoryCounts,
    };
  });

  let mostFrequentCategory = null;
  if (totalErrors > 0) {
    mostFrequentCategory = Object.entries(categoryTotals).reduce((highest, current) =>
      current[1] > highest[1] ? current : highest
    )[0];
  }

  res.status(200).json({
    studentId: req.params.studentId,
    totalSamples: samples.length,
    totalErrors,
    mostFrequentCategory,
    categoryTotals,
    trends,
  });
};

export { getStudent, getStudents, createStudent, getTrends };
