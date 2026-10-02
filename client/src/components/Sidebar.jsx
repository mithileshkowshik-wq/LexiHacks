// The app shell's persistent sidebar: brand, navigation, and the signed-in
// therapist. Present on every screen — and every screen this renders on
// already passed RequireAuth.jsx's session check to get here.
//
// The identity block reads lib/session.js (set by LoginPage on a successful
// sign-in). The placeholder below is defensive rather than a real code
// path: a session cleared out from under an already-open tab (e.g. via
// devtools) wouldn't re-trigger the route guard until the next navigation.

import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { getSession } from '../lib/session.js';

const PLACEHOLDER = { name: 'Not signed in', role: 'Guest', initials: '?' };

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Sidebar() {
  const session = getSession();
  const identity = session
    ? {
        name: session.name || session.username,
        role: session.role || 'Signed in',
        initials: initials(session.name || session.username),
      }
    : PLACEHOLDER;

  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo size={28} variant="light" className="brand__mark" />
        <span className="brand__name">LexiPath</span>
      </div>

      <nav className="nav" aria-label="Main">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav__item${isActive ? ' nav__item--active' : ''}`
          }
        >
          <Icon name="students" size={19} />
          My students
        </NavLink>
      </nav>

      <NavLink to="/account" className="therapist">
        <span className="therapist__avatar" aria-hidden="true">
          {identity.initials}
        </span>
        <span className="therapist__meta">
          <span className="therapist__name">{identity.name}</span>
          <span className="therapist__role">{identity.role}</span>
        </span>
      </NavLink>
    </aside>
  );
}
