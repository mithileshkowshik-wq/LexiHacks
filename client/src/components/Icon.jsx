// Small inline icon set — no icon dependency, stroke inherits currentColor.

const PATHS = {
  upload: (
    <>
      <path d="M12 15V4M12 4l-4 4M12 4l4 4" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </>
  ),
  trends: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l3-4 3 2 4-6" />
    </>
  ),
  recommendations: (
    <>
      <path d="M12 3l2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 13.9 7.8 16l.8-4.7L5.2 8l4.7-.7L12 3z" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  students: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M16 6a3 3 0 0 1 0 6M20 20c0-2.4-1.4-4.3-3.5-4.8" />
    </>
  ),
  page: (
    <>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13M12 16.4v.1" />
    </>
  ),

  /* Error report (screen 3) — scan controls and card actions */
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6" />
    </>
  ),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  expand: <path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7" />,
  swap: <path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3" />,
  trash: (
    <>
      <path d="M4 7h16M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7" />
      <path d="M6.5 7l.9 12.1A1 1 0 0 0 8.4 20h7.2a1 1 0 0 0 1-.9L17.5 7" />
    </>
  ),
  undo: <path d="M4 9h10a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4" />,
  refresh: <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6M20.5 3.5V9h-5.5" />,

  /* Category marks. Filled shapes, so each overrides the sheet's
     fill="none" / stroke="currentColor" — the six categories are told apart
     by SHAPE, never colour (see lib/categories.js). */
  catPhonological: <path d="M12 3.5L20.5 12 12 20.5 3.5 12 12 3.5z" fill="currentColor" stroke="none" />,
  catOrthographic: <circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" />,
  catMorphological: <path d="M12 3.5L21 20H3L12 3.5z" fill="currentColor" stroke="none" />,
  catCapitalisation: <rect x="4.5" y="4.5" width="15" height="15" fill="currentColor" stroke="none" />,
  catPunctuation: <path d="M12 4v16M4 12h16" strokeWidth="3.6" />,
  catUnsure: (
    <path
      d="M8.6 9.2a3.5 3.5 0 1 1 4.3 3.4c-.6.2-1 .8-1 1.4v.6M12 18.4v.1"
      strokeWidth="2.2"
    />
  ),
};

export default function Icon({ name, size = 18, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
