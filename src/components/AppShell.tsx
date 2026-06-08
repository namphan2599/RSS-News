import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { listRedditPostSummariesByDate, type RedditPostSummary } from "../api/redditPostsApi";
import { SidebarDateControls } from "./SidebarDateControls";

type Theme = "light" | "dark";

export type AppShellContext = {
  selectedDigestDate: string;
  selectedRedditDate: string;
  redditPosts: RedditPostSummary[];
  selectedRedditPost: RedditPostSummary | null;
  redditError: string | null;
  redditLoading: boolean;
};

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return formatDate(date);
}

function getDigestDateFromPath(pathname: string) {
  const match = pathname.match(/^\/digests\/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load Reddit news.";
}

function formatPublishedTime(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [selectedDigestDate, setSelectedDigestDate] = useState(() => getDigestDateFromPath(location.pathname) ?? formatDate(new Date()));
  const [selectedRedditDate, setSelectedRedditDate] = useState(() => formatDate(new Date()));
  const [redditPosts, setRedditPosts] = useState<RedditPostSummary[]>([]);
  const [selectedRedditPostId, setSelectedRedditPostId] = useState<string | null>(null);
  const [redditError, setRedditError] = useState<string | null>(null);
  const [redditLoading, setRedditLoading] = useState(false);
  const isDigestView = location.pathname === "/" || location.pathname.startsWith("/digests");
  const isRedditView = location.pathname.startsWith("/reddit");

  useEffect(() => {
    const routeDate = getDigestDateFromPath(location.pathname);
    if (routeDate) setSelectedDigestDate(routeDate);
  }, [location.pathname]);

  useEffect(() => {
    if (!isRedditView) return;

    let active = true;
    setRedditLoading(true);
    setRedditError(null);
    setRedditPosts([]);
    setSelectedRedditPostId(null);

    listRedditPostSummariesByDate(selectedRedditDate)
      .then((nextPosts) => {
        if (!active) return;
        setRedditPosts(nextPosts);
        setSelectedRedditPostId(nextPosts[0]?.id ?? null);
      })
      .catch((err) => {
        if (active) setRedditError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setRedditLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isRedditView, selectedRedditDate]);

  const selectedRedditPost = redditPosts.find((post) => post.id === selectedRedditPostId) ?? redditPosts[0] ?? null;
  const redditPostsByDate = redditPosts.reduce<Record<string, RedditPostSummary[]>>((groups, post) => {
    groups[post.summary_date] = groups[post.summary_date] ?? [];
    groups[post.summary_date].push(post);
    return groups;
  }, {});
  const redditPostDates = Object.keys(redditPostsByDate);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem("theme", nextTheme);
      return nextTheme;
    });
  }

  function goToDigestDate(nextDate: string) {
    setSelectedDigestDate(nextDate);
    navigate(`/digests/${nextDate}`);
  }

  function goToRedditDate(nextDate: string) {
    setSelectedRedditDate(nextDate);
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <button
        className="theme-toggle-button"
        type="button"
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        onClick={toggleTheme}
      >
        {theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
      </button>

      <div className="shell-frame">
        <aside className="shell-sidebar" aria-label="App navigation">
          <div className="shell-brand">
            <span className="shell-brand-kicker">AI briefing</span>
            <span className="shell-brand-title">NewsDigest</span>
          </div>

          <nav className="shell-nav" aria-label="View switch">
            <div className="view-tabs">
              <NavLink
                className={() => `view-tab${isDigestView ? " is-active" : ""}`}
                to={`/digests/${selectedDigestDate}`}
              >
                Digest
              </NavLink>
              <NavLink
                className={({ isActive }) => `view-tab${isActive ? " is-active" : ""}`}
                to="/reddit"
              >
                Reddit
              </NavLink>
            </div>
          </nav>

          {isDigestView && (
            <SidebarDateControls
              ariaLabel="Digest date controls"
              label="Digest date"
              onChange={(value) => value && goToDigestDate(value)}
              onNext={() => goToDigestDate(shiftDate(selectedDigestDate, 1))}
              onPrevious={() => goToDigestDate(shiftDate(selectedDigestDate, -1))}
              value={selectedDigestDate}
            />
          )}

          {isRedditView && !redditLoading && !redditError && redditPosts.length > 0 && (
            <div className="sidebar-reddit-posts" aria-label="Reddit posts">
              <SidebarDateControls
                ariaLabel="Reddit date controls"
                label="Reddit date"
                onChange={(value) => value && goToRedditDate(value)}
                onNext={() => goToRedditDate(shiftDate(selectedRedditDate, 1))}
                onPrevious={() => goToRedditDate(shiftDate(selectedRedditDate, -1))}
                value={selectedRedditDate}
              />
              <span className="sidebar-control-label">Posts</span>
              <div className="reddit-post-list">
                {redditPostDates.map((summaryDate) => (
                  <section className="reddit-date-group" key={summaryDate}>
                    <h3 className="reddit-date-heading">{summaryDate}</h3>
                    {redditPostsByDate[summaryDate].map((post) => {
                      const publishedTime = formatPublishedTime(post.published_at);
                      const selected = post.id === selectedRedditPost?.id;

                      return (
                        <button
                          aria-pressed={selected}
                          className={`reddit-post-item${selected ? " is-selected" : ""}`}
                          key={post.id}
                          onClick={() => setSelectedRedditPostId(post.id)}
                          type="button"
                        >
                          <span className="reddit-card-meta">
                            <span className="reddit-subreddit">r/{post.subreddit}</span>
                          </span>
                          <span className="reddit-post-title">{post.title}</span>
                          {publishedTime && <span className="reddit-post-time">{publishedTime}</span>}
                        </button>
                      );
                    })}
                  </section>
                ))}
              </div>
            </div>
          )}

          {isRedditView && (redditLoading || redditError || redditPosts.length === 0) && (
            <SidebarDateControls
              ariaLabel="Reddit date controls"
              label="Reddit date"
              onChange={(value) => value && goToRedditDate(value)}
              onNext={() => goToRedditDate(shiftDate(selectedRedditDate, 1))}
              onPrevious={() => goToRedditDate(shiftDate(selectedRedditDate, -1))}
              value={selectedRedditDate}
            />
          )}

        </aside>

        <main className="main-panel">
          <Outlet
            context={{
              selectedDigestDate,
              selectedRedditDate,
              redditPosts,
              selectedRedditPost,
              redditError,
              redditLoading,
            } satisfies AppShellContext}
          />
        </main>
      </div>
    </div>
  );
}
