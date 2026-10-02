// ------------------------------------------------------------------
// The single seam between the UI and the backend.
//
// Every function here maps to a route in server/routes/, so the pages
// never touch fetch() or URLs themselves.
//
//   VITE_API_URL          base origin for the API (default "/api")
//   VITE_API_TIMEOUT_MS   fail API calls instead of leaving screens in skeleton state
//   VITE_DEBUG_API=true   include endpoint/status details in UI errors and console logs
//
// Students AND samples routes are live now — the old mockData.js is gone.
// ------------------------------------------------------------------

import { getToken, clearSession } from './session.js';

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const DEBUG_API = import.meta.env.VITE_DEBUG_API === 'true';
const API_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_API_TIMEOUT_MS ?? '12000', 10);

function apiDebug(message, details = {}) {
  if (DEBUG_API) console.info(`[api] ${message}`, details);
}

function debugMessage(message, details) {
  if (!DEBUG_API) return message;
  const extra = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return extra ? `${message} (${extra})` : message;
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timeout =
    Number.isFinite(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0
      ? window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
      : null;
  let res;
  apiDebug('request-start', { method, url });
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (error) {
    const timedOut = error.name === 'AbortError';
    apiDebug('request-failed', { method, url, reason: timedOut ? 'timeout' : error.message });
    throw new Error(
      debugMessage(timedOut ? 'API request timed out' : 'API request failed', {
        method,
        url,
        timeoutMs: timedOut ? API_TIMEOUT_MS : undefined,
        reason: timedOut ? undefined : error.message,
      }),
      { cause: error }
    );
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
  apiDebug('response', { method, url, status: res.status });
  if (!res.ok) {
    let payload;
    try {
      payload = await res.json();
    } catch {
      /* body was not JSON */
    }
    const detail = payload?.error?.message ?? payload?.message;

    // Only an actual dead token (UNAUTHENTICATED, from requireAuth - missing,
    // invalid, or expired) should force a sign-out. Other 401s on an
    // authenticated request - e.g. "current password is incorrect" on
    // change-password - are an answer to the request itself, not a verdict
    // on the session, and must be left for the calling page to show inline
    // instead of silently bouncing someone who's still signed in. Login's
    // own 401 for wrong credentials never carries a token in the first
    // place, so it was already excluded by the `token` check alone.
    if (res.status === 401 && token && payload?.error?.code === 'UNAUTHENTICATED') {
      clearSession();
      window.location.assign('/login');
    }
    const error = new Error(
      debugMessage(detail || `Request failed (${res.status})`, { method, url, status: res.status })
    );
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// GET /api/students  ->  Student[]
export function getStudents() {
  return request('/students');
}

// GET /api/students/:studentId  ->  { studentId, name, currentGrade, programme?, band?, programmeYear?, term?, week? }
// Resolves to null on 404 so the profile page can show its "not found"
// screen instead of a generic error. (StudentProfilePage and
// UploadSamplePage both branch on the null — don't drop this catch.)
export function getStudent(studentId) {
  return request(`/students/${studentId}`).catch((err) => {
    if (err.status === 404) return null;
    throw err;
  });
}

// POST /api/students  { name, currentGrade, programme?, band?, programmeYear?, term?, week? }  ->  created student
export function createStudent(student) {
  return request('/students', { method: 'POST', body: student });
}

// GET /api/students/:studentId/samples?status=  ->  lightweight summaries,
// newest first: { sampleId, title, uploadedAt, analysisStatus, imageCount }.
// Never carries errors/content — see paths.txt. Powers the profile's sample
// list. For trend data use getStudentTrends() below, not this.
export function getStudentSamples(studentId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/students/${studentId}/samples${qs}`);
}

// GET /api/students/:studentId/trends?from=&to=  ->
//   { studentId, totalSamples, totalErrors, mostFrequentCategory,
//     categoryTotals, trends: [{ sampleId, title, date, totalErrors,
//     categoryCounts }] }
// Computed server-side from stored SampleReports; totalErrors/categoryCounts
// already exclude dismissed tags and only count ANALYSED/REVIEWED samples,
// so it reconciles exactly with the review screen's own counts.
export function getStudentTrends(studentId, { from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return request(`/students/${studentId}/trends${qs ? `?${qs}` : ''}`);
}

// GET the latest report. `isOutdated` is computed from source sample updates;
// the expected no-report 404 is not a page-level failure.
export async function getLatestRecommendations(studentId) {
  try {
    return (await request(`/students/${studentId}/recommendations/latest`)).report;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// Generate and replace the student's latest intervention report.
export async function generateRecommendations(studentId) {
  return (
    await request(`/students/${studentId}/recommendations`, {
      method: 'POST',
      body: {},
    })
  ).report;
}

// The browser receives only a stable approved ID, never an Azure blob path or SAS URL.
// Mock worksheet records carry available=false, so the UI does not offer a dead link.
//
// Opened via a plain <a href>, not fetch() - can't attach an Authorization
// header, so the token rides along as ?token= instead (requireAuth's
// documented fallback for exactly this case).
export function worksheetFileUrl(worksheetId) {
  const token = getToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${BASE}/worksheets/${encodeURIComponent(worksheetId)}/file${query}`;
}

// GET /api/samples/:sampleId  ->  one sample, with its errors.
//
// The upload page polls this to notice UPLOADED -> ANALYSED; the review
// screen (3a) reads the whole thing. On top of the summary shape it carries
// studentId, illegibleNote, analysisError and:
//
//   errors: [{ errorIndex, written, intended, category, confidenceScore,
//              locationOnScan: { page, x, y, z, w } | null, note, dismissed }]
//
// errorIndex is the error's position in the sample's errors array — the only
// handle there is, since the sub-schema has no _id. It stays stable because
// removing a tag sets dismissed rather than deleting the entry.
export function getSample(sampleId) {
  return request(`/samples/${sampleId}`);
}

// The scan itself. NOT routed through request() — that parses JSON, and this
// is an image the browser loads via <img src>, so (like worksheetFileUrl
// above) the token has to travel as ?token= rather than a header. index is
// 0-based into the sample's pages, so it runs 0 .. imageCount - 1.
export function sampleImageUrl(sampleId, index) {
  const token = getToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${BASE}/samples/${sampleId}/images/${index}${query}`;
}

// PATCH /api/samples/:sampleId/errors/:errorIndex  ->  the updated sample
// (same shape as getSample), so the screen repaints its counts and groups
// from one response instead of reconciling locally.
//
// A partial update — send only what changes:
//   { category }         reclassify (must be one of ERROR_CATEGORIES)
//   { dismissed: true }  remove the tag   { dismissed: false }  restore it
//   { confidenceScore }  1 when the educator confirms an uncertain tag
// Use errorIndex "new" with { written, category } to record an error the AI missed.
export function updateSampleError(sampleId, errorIndex, patch) {
  return request(`/samples/${sampleId}/errors/${errorIndex}`, {
    method: 'PATCH',
    body: patch,
  });
}

// PATCH /api/samples/:sampleId  { status }  ->  the updated sample.
// Behind "Mark review done" on 3a: ANALYSED -> REVIEWED.
export function markSampleReviewed(sampleId) {
  return request(`/samples/${sampleId}`, {
    method: 'PATCH',
    body: { status: 'REVIEWED' },
  });
}

// POST /api/auth/login  { username, password }  ->  account (no password)
export function login({ username, password }) {
  return request('/auth/login', { method: 'POST', body: { username, password } });
}

// POST /api/auth/forgot-password  { username }  ->  { message }
// Always resolves 200 whether or not the username exists, so the caller
// can't use this to discover which usernames are registered.
export function requestPasswordReset({ username }) {
  return request('/auth/forgot-password', { method: 'POST', body: { username } });
}

// POST /api/auth/reset-password/:token  { password }  ->  { message }
export function resetPassword(token, { password }) {
  return request(`/auth/reset-password/${token}`, { method: 'POST', body: { password } });
}

// GET /api/auth/account  ->  { username, name, email, phoneNumber, role,
// organisation, createdAt } for whoever the session token belongs to —
// there's no way to ask for anyone else's. Powers AccountPage. Requires a
// session (see request()'s Authorization header).
export function getAccount() {
  return request('/auth/account');
}

// PATCH /api/auth/change-password  { currentPassword, newPassword }  ->
// { message }. Acts on the signed-in caller's own account (the server reads
// that from the session token, not from anything this call sends).
// Distinct from resetPassword() — this is the logged-in "I know my current
// password" flow, not the emailed-token one.
export function changePassword({ currentPassword, newPassword }) {
  return request('/auth/change-password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  });
}

// POST /api/samples/:studentId  ->  the created sample summary.
// Multipart, not JSON: the files go under the field "samples" (they all
// become pages of ONE sample) with title/taskType alongside. We build the
// FormData here so pages stay fetch-free; note we must NOT set a
// Content-Type header — the browser writes the multipart boundary itself.
export function uploadSample(studentId, { title, taskType, files }) {
  const form = new FormData();
  form.append('title', title);
  form.append('taskType', taskType);
  for (const file of files) {
    form.append('samples', file);
  }
  const token = getToken();
  return fetch(`${BASE}/samples/${studentId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  }).then(async (res) => {
    if (!res.ok) {
      let detail;
      try {
        const payload = await res.json();
        detail = payload?.error?.message ?? payload?.message;
      } catch {
        /* body was not JSON */
      }
      const error = new Error(detail || `Upload failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  });
}
