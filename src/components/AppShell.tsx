import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppShell() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem("theme", nextTheme);
      return nextTheme;
    });
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="shell-frame">
        <aside className="shell-sidebar" aria-label="App navigation">
          <div className="shell-brand">
            <span className="shell-brand-kicker">AI briefing</span>
            <span className="shell-brand-title">NewsDigest</span>
          </div>

          <nav className="shell-nav">
            <NavLink to="/digests">Daily Digest</NavLink>
            <NavLink to="/reddit">Reddit News</NavLink>
            <NavLink to="/admin">Admin</NavLink>
          </nav>

          <button
            className="theme-button"
            type="button"
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            onClick={toggleTheme}
          >
            {theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            <span>{theme === "light" ? "Dark" : "Light"}</span>
          </button>
        </aside>

        <main className="main-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
