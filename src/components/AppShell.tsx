import { BookOpen, Menu, Moon, Rss, Settings, Sun, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  function closeNav() {
    setNavOpen(false);
  }

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem("theme", nextTheme);
      return nextTheme;
    });
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <button className="menu-button" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
        <Menu size={20} aria-hidden="true" />
      </button>

      <button
        className="theme-button"
        type="button"
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        onClick={toggleTheme}
      >
        {theme === "light" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
      </button>

      {navOpen && <button className="nav-backdrop" type="button" aria-label="Close navigation overlay" onClick={closeNav} />}

      {navOpen && (
        <aside className="sidebar" aria-label="App navigation">
          <div className="sidebar-header">
            <div>
              <div className="brand">
                <span aria-hidden="true">*</span> RSS Digest
              </div>
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
        </aside>
      )}

      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
