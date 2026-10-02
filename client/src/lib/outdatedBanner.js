// Persists "you corrected a tag, recommendations may be outdated" banner
// dismissals across a reload, same localStorage pattern as session.js.
// Keyed per report (not per student): adopting/regenerating a report gets a
// new reportId, so a stale dismissal never suppresses a fresh warning.

const KEY = 'lexipath.dismissedOutdatedBanners';

function readDismissed() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isOutdatedBannerDismissed(reportId) {
  return reportId != null && readDismissed().includes(reportId);
}

export function dismissOutdatedBanner(reportId) {
  if (reportId == null) return;
  const dismissed = readDismissed();
  if (!dismissed.includes(reportId)) {
    localStorage.setItem(KEY, JSON.stringify([...dismissed, reportId]));
  }
}
