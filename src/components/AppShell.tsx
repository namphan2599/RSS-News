import { BookOpen, Rss, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function AppShell() {
  const { session, signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">RSS Digest</div>
        <p className="sidebar-user">{session?.user.email ?? "Unknown user"}</p>
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
        <button className="sidebar-signout" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </aside>
      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
