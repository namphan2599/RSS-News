import { BookOpen, Menu, Rss, Settings, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function AppShell() {
  const { session, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  function closeNav() {
    setNavOpen(false);
  }

  return (
    <div className="app-shell">
      <button className="menu-button" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
        <Menu size={20} aria-hidden="true" />
      </button>

      {navOpen && <button className="nav-backdrop" type="button" aria-label="Close navigation overlay" onClick={closeNav} />}

      {navOpen && (
        <aside className="sidebar" aria-label="App navigation">
          <div className="sidebar-header">
            <div>
              <div className="brand">
                <span aria-hidden="true">*</span> RSS Digest
              </div>
              <p className="sidebar-user">{session?.user.email ?? "Unknown user"}</p>
            </div>
            <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={closeNav}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Primary navigation">
            <NavLink to="/digests" onClick={closeNav}>
              <BookOpen size={18} aria-hidden="true" />
              Digests
            </NavLink>
            <NavLink to="/feeds" onClick={closeNav}>
              <Rss size={18} aria-hidden="true" />
              Feeds
            </NavLink>
            <NavLink to="/settings" onClick={closeNav}>
              <Settings size={18} aria-hidden="true" />
              Settings
            </NavLink>
          </nav>
          <button className="sidebar-signout" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </aside>
      )}

      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
