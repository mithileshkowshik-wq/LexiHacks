// App shell: the persistent sidebar wraps a routed content area. Every page
// renders into <Outlet/>, so the sidebar stays put across navigation.

import { Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import './App.css';

export default function App() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
