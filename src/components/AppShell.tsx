import { BookOpen, Rss, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">RSS Digest</div>
        <nav>
          <NavLink to="/digests">
            <BookOpen size={18} />
            Digests
          </NavLink>
          <NavLink to="/feeds">
            <Rss size={18} />
            Feeds
          </NavLink>
          <NavLink to="/settings">
            <Settings size={18} />
            Settings
          </NavLink>
        </nav>
      </aside>
      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
