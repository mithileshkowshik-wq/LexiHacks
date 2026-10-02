// Entry screen (GET /api/students): the therapist's caseload. Pick a
// student to land on their profile (1a / 1b). The search box filters the
// grid client-side as you type — no server round-trip needed at this
// caseload size. "Add student" opens an inline form card that POSTs to
// /api/students and drops the new student at the top of the grid.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStudents, createStudent } from '../lib/api.js';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';

export default function StudentsListPage() {
  const [state, setState] = useState({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let live = true;
    getStudents()
      .then((students) => live && setState({ status: 'ready', students }))
      .catch((err) => live && setState({ status: 'error', message: err.message }));
    return () => {
      live = false;
    };
  }, []);

  const visibleStudents = state.status === 'ready' ? filterByName(state.students, query) : [];

  const handleCreated = (student) => {
    setState((s) =>
      s.status === 'ready' ? { status: 'ready', students: [student, ...s.students] } : s
    );
    setFormOpen(false);
  };

  return (
    <div className="students">
      {/* Page header pattern: eyebrow → title → sub, actions on the right */}
      <header className="students__head">
        <div className="students__id">
          <span className="eyebrow">Caseload</span>
          <h1 className="students__title">My students</h1>
          <p className="students__sub">Choose a student to open their profile.</p>
        </div>

        <div className="students__tools">
          <div className="search">
            <Icon name="search" size={17} />
            <input
              className="search__input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search students by name…"
              aria-label="Search students by name"
            />
          </div>
          <Button variant="primary" icon="plus" onClick={() => setFormOpen((open) => !open)}>
            Add student
          </Button>
        </div>
      </header>

      {formOpen && <NewStudentForm onCreated={handleCreated} onCancel={() => setFormOpen(false)} />}

      {state.status === 'loading' && (
        <div className="students__grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel skel--card" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="feedback__text feedback--error">{state.message}</p>
      )}

      {state.status === 'ready' &&
        (visibleStudents.length > 0 ? (
          <div className="students__grid">
            {visibleStudents.map((student) => (
              <Link
                key={student.studentId}
                to={`/students/${student.studentId}`}
                className="student-card"
              >
                <span className="student-card__avatar" aria-hidden="true">
                  {initials(student.name)}
                </span>
                <span className="student-card__body">
                  <span className="student-card__name">{student.name}</span>
                  <span className="student-card__grade">{student.currentGrade}</span>
                </span>
                <Icon name="arrow" size={20} className="student-card__go" />
              </Link>
            ))}
          </div>
        ) : state.students.length === 0 ? (
          <p className="students__sub">
            No students yet — add your first student to start the caseload.
          </p>
        ) : (
          <p className="students__sub">
            No students match “{query}”. Clear the search to see the full caseload.
          </p>
        ))}
    </div>
  );
}

// Inline form card (POST /api/students). Kept on this page rather than a
// modal — a new sheet of paper slides in above the grid, per the design's
// "sheets of paper, not app bubbles" language.
function NewStudentForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [currentGrade, setCurrentGrade] = useState('');
  const [programme, setProgramme] = useState('');
  const [band, setBand] = useState('');
  const [programmeYear, setProgrammeYear] = useState('');
  const [term, setTerm] = useState('');
  const [week, setWeek] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const student = await createStudent({
        name: name.trim(),
        currentGrade: currentGrade.trim(),
        ...(programme.trim() && { programme: programme.trim() }),
        ...(band.trim() && { band: band.trim().toUpperCase() }),
        ...(programmeYear && { programmeYear: Number.parseInt(programmeYear, 10) }),
        ...(term && { term: Number.parseInt(term, 10) }),
        ...(week && { week: Number.parseInt(week, 10) }),
      });
      onCreated(student);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form className="student-form" onSubmit={handleSubmit}>
      <h2 className="student-form__title">Add a new student</h2>
      <div className="student-form__fields">
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Wei Jie Lim"
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span className="field__label">Current grade</span>
          <input
            className="field__input"
            type="text"
            value={currentGrade}
            onChange={(event) => setCurrentGrade(event.target.value)}
            placeholder="e.g. Primary 4"
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Programme</span>
          <input
            className="field__input"
            type="text"
            value={programme}
            onChange={(event) => setProgramme(event.target.value)}
            placeholder="e.g. SLP"
          />
        </label>
        <label className="field">
          <span className="field__label">Band</span>
          <input
            className="field__input"
            type="text"
            value={band}
            onChange={(event) => setBand(event.target.value)}
            placeholder="A, B, or C"
            maxLength={1}
          />
        </label>
        <label className="field">
          <span className="field__label">Programme year</span>
          <input
            className="field__input"
            type="number"
            name="programmeYear"
            min="1"
            value={programmeYear}
            onChange={(event) => setProgrammeYear(event.target.value)}
            placeholder="e.g. 1"
          />
        </label>
        <label className="field">
          <span className="field__label">Term</span>
          <input
            className="field__input"
            type="number"
            name="term"
            min="1"
            max="4"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="e.g. 1"
          />
        </label>
        <label className="field">
          <span className="field__label">Week</span>
          <input
            className="field__input"
            type="number"
            min="1"
            value={week}
            onChange={(event) => setWeek(event.target.value)}
            placeholder="e.g. 4"
          />
        </label>
      </div>
      {error && <p className="student-form__error">{error}</p>}
      <div className="student-form__actions">
        {/* Not the `disabled` prop while saving — that's the dashed "locked
            feature" look; double-submit is guarded in handleSubmit instead. */}
        <Button variant="primary" icon="plus" type="submit">
          {saving ? 'Adding…' : 'Add student'}
        </Button>
        <Button variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function filterByName(students, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return students;
  return students.filter((s) => s.name.toLowerCase().includes(needle));
}

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
