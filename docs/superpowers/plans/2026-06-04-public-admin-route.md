# Public Admin Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove public sidebar navigation and add a login-protected `/admin` route for feed management and status checks.

**Architecture:** Keep digest routes public under the existing `AppShell`, but simplify that shell to theme-only layout. Add `AdminPage` as one authenticated page that reuses existing feed and run APIs. Redirect legacy `/feeds` and `/settings` paths to `/admin`.

**Tech Stack:** Vite, React, TypeScript, React Router, Supabase client, Vitest, Testing Library.

---

## File Structure

- Modify `src/App.tsx`: route split, `/login`, `/admin`, legacy redirects.
- Modify `src/components/AppShell.tsx`: remove sidebar/menu code, keep theme toggle and outlet.
- Create `src/pages/AdminPage.tsx`: combine feed add/update/status and recent run status.
- Modify `src/components/FeedList.tsx`: add inline edit controls and status metadata.
- Modify `src/api/feedsApi.ts`: allow URL/title/category/status updates where needed.
- Modify `src/pages/LoginPage.tsx`: redirect signed-in users to `/admin`.
- Modify `src/styles.css`: remove unused sidebar rules, add admin/feed edit styles.
- Modify `src/App.test.tsx`: update route/nav tests and admin route assertions.

## Task 1: Routing and Public Shell Tests

**Files:**
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Replace sidebar navigation tests with public shell and admin route tests**

Remove tests named:

```ts
it("hides navigation by default and opens it from the menu button", async () => {});
it("closes navigation with the close button", async () => {});
it("closes navigation with the backdrop", async () => {});
it("closes navigation after clicking a nav link", async () => {});
```

Add tests after the root route test:

```ts
it("does not show public navigation controls", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-05-29T08:00:00"));
  digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/"]}
    >
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Open navigation" })).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
});

it("renders the admin page at /admin", async () => {
  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/admin"]}
    >
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
  expect(screen.getByText("Manage feeds and check digest health." )).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Feeds" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Recent Runs" })).toBeInTheDocument();
});

it("redirects old feed and settings routes to admin", async () => {
  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/feeds"]}
    >
      <App />
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failures**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because `/admin` route and no-sidebar behavior are not implemented yet.

## Task 2: Route Split and Shell Simplification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Update routes in `src/App.tsx`**

Use this route structure:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { AdminPage } from "./pages/AdminPage";
import { DigestDetailPage } from "./pages/DigestDetailPage";
import { DigestsPage } from "./pages/DigestsPage";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/digests" replace />} />
        <Route path="/digests" element={<DigestsPage />} />
        <Route path="/digests/:date" element={<DigestDetailPage />} />
        <Route path="/feeds" element={<Navigate to="/admin" replace />} />
        <Route path="/settings" element={<Navigate to="/admin" replace />} />
        <Route
          path="/admin"
          element={(
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          )}
        />
      </Route>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Simplify `src/components/AppShell.tsx`**

Replace with:

```tsx
import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";

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
      <button
        className="theme-button"
        type="button"
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        onClick={toggleTheme}
      >
        {theme === "light" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
      </button>

      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update login redirect in `src/pages/LoginPage.tsx`**

Change signed-in redirect:

```tsx
if (!loading && session) {
  return <Navigate to="/admin" replace />;
}
```

- [ ] **Step 4: Run tests and verify remaining failures**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because `AdminPage` does not exist yet.

## Task 3: Admin Page and Feed Editing

**Files:**
- Create: `src/pages/AdminPage.tsx`
- Modify: `src/components/FeedList.tsx`
- Modify: `src/api/feedsApi.ts`

- [ ] **Step 1: Expand feed update input in `src/api/feedsApi.ts`**

Use:

```ts
export async function updateFeed(
  id: string,
  input: Partial<Pick<Feed, "title" | "category" | "is_active" | "url">>,
): Promise<void> {
  const { error } = await supabase.from("feeds").update(input).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Replace `src/components/FeedList.tsx` with editable feed list**

Use:

```tsx
import { type FormEvent, useState } from "react";
import type { Feed } from "../api/feedsApi";

export function FeedList({
  feeds,
  onToggle,
  onDelete,
  onUpdate,
}: {
  feeds: Feed[];
  onToggle: (feed: Feed) => Promise<void>;
  onDelete: (feed: Feed) => Promise<void>;
  onUpdate: (feed: Feed, input: { title: string; category: string }) => Promise<void>;
}) {
  return (
    <div className="feed-list">
      {feeds.map((feed) => (
        <FeedRow feed={feed} key={feed.id} onDelete={onDelete} onToggle={onToggle} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function FeedRow({
  feed,
  onToggle,
  onDelete,
  onUpdate,
}: {
  feed: Feed;
  onToggle: (feed: Feed) => Promise<void>;
  onDelete: (feed: Feed) => Promise<void>;
  onUpdate: (feed: Feed, input: { title: string; category: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(feed.title ?? "");
  const [category, setCategory] = useState(feed.category ?? "");
  const [saving, setSaving] = useState(false);

  async function saveFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onUpdate(feed, { title, category });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="feed-row">
      <div className="feed-details">
        <strong>{feed.title || feed.url}</strong>
        <p>{feed.url}</p>
        <p>{feed.is_active ? "Active" : "Inactive"}</p>
        <p>{feed.last_fetched_at ? `Last fetched ${feed.last_fetched_at}` : "Never fetched"}</p>
        {feed.last_error && <p className="error-text">{feed.last_error}</p>}
      </div>
      <form className="feed-edit-form" onSubmit={saveFeed}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
        <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
      </form>
      <div className="feed-actions">
        <button type="button" onClick={() => onToggle(feed)}>
          {feed.is_active ? "Disable" : "Enable"}
        </button>
        <button type="button" onClick={() => onDelete(feed)}>
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/pages/AdminPage.tsx`**

Use:

```tsx
import { useEffect, useState } from "react";
import { createFeed, deleteFeed, type Feed, listFeeds, updateFeed } from "../api/feedsApi";
import { listRecentRuns, type DigestRun } from "../api/runsApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { FeedForm } from "../components/FeedForm";
import { FeedList } from "../components/FeedList";
import { RunStatusBadge } from "../components/RunStatusBadge";

export function AdminPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refreshFeeds() {
    setFeeds(await listFeeds());
  }

  useEffect(() => {
    Promise.all([listFeeds(), listRecentRuns()])
      .then(([nextFeeds, nextRuns]) => {
        setFeeds(nextFeeds);
        setRuns(nextRuns);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load admin data"));
  }, []);

  async function addFeed(input: { url: string; title?: string; category?: string }) {
    setError(null);
    try {
      await createFeed(input);
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add feed");
    }
  }

  async function saveFeed(feed: Feed, input: { title: string; category: string }) {
    setError(null);
    try {
      await updateFeed(feed.id, { title: input.title || null, category: input.category || null });
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update feed");
    }
  }

  async function toggleFeed(feed: Feed) {
    setError(null);
    try {
      await updateFeed(feed.id, { is_active: !feed.is_active });
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update feed status");
    }
  }

  async function removeFeed(feed: Feed) {
    setError(null);
    try {
      await deleteFeed(feed.id);
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete feed");
    }
  }

  return (
    <section className="page-shell utility-page admin-page">
      <div className="page-kicker">Owner</div>
      <h1 className="page-title">Admin</h1>
      <p className="page-intro">Manage feeds and check digest health.</p>
      {error && <ErrorNotice message={error} />}

      <h2>Feeds</h2>
      <FeedForm onSubmit={addFeed} />
      {feeds.length === 0
        ? <EmptyState title="No feeds" body="Add RSS feeds to create daily digests." />
        : <FeedList feeds={feeds} onToggle={toggleFeed} onDelete={removeFeed} onUpdate={saveFeed} />}

      <h2>Recent Runs</h2>
      <div className="run-list">
        {runs.map((run) => (
          <div className="run-row" key={run.id}>
            <div>
              <strong>{run.run_date}</strong>
              <p>{run.selected_item_count} selected items, {run.failed_feed_count} failed feeds</p>
              {run.error && <p className="error-text">{run.error}</p>}
            </div>
            <RunStatusBadge status={run.status} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests and verify route tests pass or expose style-only failures**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS for route tests.

## Task 4: Styles and Final Verification

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Remove unused sidebar styles**

Delete these rule blocks from `src/styles.css`: `.menu-button`, `.nav-backdrop`, `.sidebar`, `.sidebar-header`, `.brand`, `.sidebar-user`, `.sidebar-close`, `.sidebar nav`, `.sidebar a`, `.sidebar a.active`, `.sidebar-signout`, and mobile `.menu-button`.

- [ ] **Step 2: Add admin feed edit styles**

Add near feed styles:

```css
.admin-page h2 {
  color: var(--color-ink);
  font-family: "Cormorant Garamond", "EB Garamond", Georgia, serif;
  font-size: 34px;
  font-weight: 400;
  margin: 34px 0 14px;
}

.feed-details {
  min-width: 0;
}

.feed-edit-form {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) auto;
}

.feed-edit-form button {
  background: var(--color-primary);
  border: 0;
  border-radius: 8px;
  color: var(--color-on-primary);
  padding: 10px 12px;
}
```

Update mobile media block:

```css
.feed-edit-form {
  grid-template-columns: 1fr;
  width: 100%;
}
```

- [ ] **Step 3: Run full verification**

Run: `npm run test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

## Self-Review

- Spec coverage: public sidebar removal is Task 2 and Task 4; `/admin` route is Task 2; admin add/update/status is Task 3; legacy redirects and tests are Task 1 and Task 2.
- Placeholder scan: no TBD/TODO/fill-in steps.
- Type consistency: `Feed`, `DigestRun`, `onUpdate`, and `updateFeed` signatures match across tasks.
