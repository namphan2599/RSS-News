# Editorial App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the whole RSS Digest app with the warm editorial `DESIGN.md` system, make the digest reader the center focus, and hide the sidebar by default behind a drawer.

**Architecture:** Keep existing routes and data flow. Update `AppShell` to own drawer state, update `DigestsPage` markup for the centered reader, and replace CSS tokens/layout rules in `src/styles.css`. Use tests in `src/App.test.tsx` to lock navigation drawer behavior and preserve digest behavior.

**Tech Stack:** Vite, React, TypeScript, React Router, Vitest, Testing Library, lucide-react.

---

## File Structure

- Modify `.gitignore`: ignore `.superpowers/` visual-companion artifacts.
- Modify `src/components/AppShell.tsx`: hidden-by-default navigation drawer, menu button, close button, backdrop, nav-link close behavior.
- Modify `src/pages/DigestsPage.tsx`: add editorial reader structure and class names without changing fetch/date behavior.
- Modify `src/pages/FeedsPage.tsx`: add page wrapper/eyebrow classes only; preserve behavior.
- Modify `src/pages/SettingsPage.tsx`: add page wrapper/eyebrow classes only; preserve behavior.
- Modify `src/pages/LoginPage.tsx`: add login card/eyebrow classes only; preserve auth behavior.
- Modify `src/styles.css`: replace current fixed-sidebar design with DESIGN.md-inspired tokens, drawer, reader, cards, forms, responsive styles.
- Modify `src/App.test.tsx`: add drawer behavior tests and keep existing digest behavior tests passing.

## Task 1: Hidden Navigation Drawer

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Update `.gitignore` to include the visual companion directory:

```gitignore
node_modules/
dist/
*.tsbuildinfo
vite.config.js
vite.config.d.ts

.env
.superpowers/
```

- [ ] **Step 2: Write failing drawer tests**

In `src/App.test.tsx`, add these tests inside `describe("App", () => { ... })`, after the root digest test and before date navigation tests:

```tsx
  it("hides navigation by default and opens it from the menu button", async () => {
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
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Digests/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Feeds/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeInTheDocument();
  });

  it("closes navigation with the close button", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });

  it("closes navigation after clicking a nav link", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("link", { name: /Feeds/i }));

    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Feeds" })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run focused test to verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because `Open navigation` button does not exist and the current sidebar navigation is visible by default.

- [ ] **Step 4: Replace `AppShell` with drawer behavior**

Replace `src/components/AppShell.tsx` with:

```tsx
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

      {navOpen && <button className="nav-backdrop" type="button" aria-label="Close navigation" onClick={closeNav} />}

      {navOpen && (
        <aside className="sidebar" aria-label="App navigation">
          <div className="sidebar-header">
            <div>
              <div className="brand"><span aria-hidden="true">✶</span> RSS Digest</div>
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
```

- [ ] **Step 5: Run focused test to verify drawer behavior passes**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS for the new drawer tests. Existing visual styling may still be old; that is fixed in later tasks.

- [ ] **Step 6: Commit drawer behavior**

Run:

```bash
git add .gitignore src/App.test.tsx src/components/AppShell.tsx
git commit -m "add hidden navigation drawer"
```

## Task 2: Digest Reader Structure

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/pages/DigestsPage.tsx`

- [ ] **Step 1: Add failing reader structure assertions**

In the `opens the root route on today's digest` test in `src/App.test.tsx`, add these assertions after the existing heading/date/getDigest assertions:

```tsx
    expect(screen.getByText("Daily briefing")).toBeInTheDocument();
    expect(screen.getByText("2026-05-29 · 3 items")).toBeInTheDocument();
```

- [ ] **Step 2: Run focused test to verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because `Daily briefing` is not rendered yet.

- [ ] **Step 3: Replace digest page markup with reader structure**

Replace only the `return (...)` block in `src/pages/DigestsPage.tsx` with:

```tsx
  return (
    <section className="digest-page page-shell">
      <div className="page-kicker">Daily briefing</div>
      <h1 className="page-title">Daily RSS Digest</h1>
      <p className="page-intro">A focused reader for the selected day&apos;s feed summary.</p>

      <div className="digest-toolbar" aria-label="Digest date controls">
        <button type="button" onClick={() => setSelectedDate((value) => shiftDate(value, -1))}>
          Previous
        </button>
        <button type="button" onClick={() => setSelectedDate((value) => shiftDate(value, 1))}>
          Next
        </button>
        <DatePicker value={selectedDate} onChange={(value) => value && setSelectedDate(value)} />
      </div>

      {loading && <p className="loading-text">Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && missingDigest && (
        <EmptyState title="No digest for this date" body={`No digest was generated for ${selectedDate}.`} />
      )}
      {showDigest && (
        <article className="digest-article">
          <header className="digest-header">
            <p className="digest-meta">
              {digest.digest_date} · {digest.item_count} {digest.item_count === 1 ? "item" : "items"}
            </p>
            <h2>{digest.title}</h2>
          </header>
          {digest.summary ? (
            <DigestViewer markdown={digest.summary} />
          ) : (
            <EmptyState title="No summary available" body="This digest does not have a stored summary." />
          )}
        </article>
      )}
    </section>
  );
```

Keep all helper functions, state, and `useEffect` unchanged.

- [ ] **Step 4: Run focused test to verify pass**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit digest reader structure**

Run:

```bash
git add src/App.test.tsx src/pages/DigestsPage.tsx
git commit -m "focus digest reader layout"
```

## Task 3: Editorial Page Classes For Other Screens

**Files:**
- Modify: `src/pages/FeedsPage.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Update `FeedsPage` classes only**

Replace the return block in `src/pages/FeedsPage.tsx` with:

```tsx
  return (
    <section className="page-shell utility-page">
      <div className="page-kicker">Sources</div>
      <h1 className="page-title">Feeds</h1>
      <p className="page-intro">Manage the RSS sources that feed your daily briefing.</p>
      {error && <ErrorNotice message={error} />}
      <FeedForm onSubmit={addFeed} />
      {feeds.length === 0
        ? <EmptyState title="No feeds" body="Add RSS feeds to create daily digests." />
        : <FeedList feeds={feeds} onToggle={toggleFeed} onDelete={removeFeed} />}
    </section>
  );
```

- [ ] **Step 2: Update `SettingsPage` classes only**

Replace the return block in `src/pages/SettingsPage.tsx` with:

```tsx
  return (
    <section className="page-shell utility-page">
      <div className="page-kicker">Operations</div>
      <h1 className="page-title">Settings</h1>
      <div className="settings-panel">
        <p>Daily generation runs at 07:00 Asia/Saigon when Supabase Cron is configured.</p>
        <p>AI provider: Gemini</p>
      </div>
      <h2>Recent Runs</h2>
      {error && <ErrorNotice message={error} />}
      <div className="run-list">
        {runs.map((run) => (
          <div className="run-row" key={run.id}>
            <div>
              <strong>{run.run_date}</strong>
              <p>
                {run.selected_item_count} selected items, {run.failed_feed_count} failed feeds
              </p>
              {run.error && <p className="error-text">{run.error}</p>}
            </div>
            <RunStatusBadge status={run.status} />
          </div>
        ))}
      </div>
    </section>
  );
```

- [ ] **Step 3: Update `LoginPage` classes only**

Replace the return block in `src/pages/LoginPage.tsx` with:

```tsx
  return (
    <section className="login-wrap">
      <div className="login-card">
        <div className="page-kicker">Private briefing</div>
        <h1 className="page-title">Sign in</h1>
        <p>Use the owner email configured in Supabase to manage feeds and read digests.</p>
        {error && <ErrorNotice message={error} />}
        {sent && (
          <div className="notice">
            Magic link sent. Open your email and continue from the login link.
          </div>
        )}
        <form className="login-form" onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit">Send magic link</button>
        </form>
      </div>
    </section>
  );
```

- [ ] **Step 4: Run focused app tests**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS. These class-only changes should not alter behavior.

- [ ] **Step 5: Commit page class updates**

Run:

```bash
git add src/pages/FeedsPage.tsx src/pages/SettingsPage.tsx src/pages/LoginPage.tsx
git commit -m "apply editorial page structure"
```

## Task 4: DESIGN.md Styling Pass

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Replace `src/styles.css` with editorial styles**

Replace the full contents of `src/styles.css` with:

```css
:root {
  color: #141413;
  background: #faf9f5;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background: #faf9f5;
}

a {
  color: inherit;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
}

.menu-button {
  align-items: center;
  background: #faf9f5;
  border: 1px solid #e6dfd8;
  border-radius: 999px;
  color: #141413;
  display: inline-flex;
  height: 42px;
  justify-content: center;
  left: 24px;
  position: fixed;
  top: 24px;
  width: 42px;
  z-index: 30;
}

.nav-backdrop {
  background: rgba(20, 20, 19, 0.28);
  border: 0;
  inset: 0;
  padding: 0;
  position: fixed;
  z-index: 40;
}

.sidebar {
  background: #181715;
  border-radius: 0 16px 16px 0;
  bottom: 0;
  color: #faf9f5;
  display: flex;
  flex-direction: column;
  gap: 24px;
  left: 0;
  max-width: min(360px, calc(100vw - 28px));
  padding: 28px;
  position: fixed;
  top: 0;
  width: 340px;
  z-index: 50;
}

.sidebar-header {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.brand {
  align-items: center;
  display: flex;
  font-size: 18px;
  font-weight: 500;
  gap: 8px;
}

.sidebar-user {
  color: #a09d96;
  font-size: 13px;
  margin: 8px 0 0;
}

.sidebar-close {
  align-items: center;
  background: #252320;
  border: 1px solid rgba(250, 249, 245, 0.14);
  border-radius: 999px;
  color: #faf9f5;
  display: inline-flex;
  height: 36px;
  justify-content: center;
  width: 36px;
}

.sidebar nav {
  display: grid;
  gap: 8px;
}

.sidebar a {
  align-items: center;
  border-radius: 8px;
  color: #faf9f5;
  display: flex;
  gap: 10px;
  padding: 12px;
  text-decoration: none;
}

.sidebar a.active {
  background: #252320;
}

.sidebar-signout {
  background: #252320;
  border: 1px solid rgba(250, 249, 245, 0.14);
  border-radius: 8px;
  color: #faf9f5;
  margin-top: auto;
  padding: 12px 14px;
}

.main-panel {
  margin: 0 auto;
  max-width: 1180px;
  padding: 72px 32px 48px;
}

.page-shell {
  margin: 0 auto;
  max-width: 920px;
}

.utility-page {
  max-width: 1040px;
}

.page-kicker {
  color: #cc785c;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 1.5px;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.page-title,
.digest-header h2,
.login-card h1 {
  color: #141413;
  font-family: "Cormorant Garamond", "EB Garamond", Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1.06;
  margin: 0;
}

.page-title {
  font-size: clamp(42px, 8vw, 72px);
}

.page-intro {
  color: #3d3d3a;
  font-size: 18px;
  line-height: 1.55;
  margin: 14px 0 28px;
  max-width: 620px;
}

.digest-toolbar {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 24px;
}

.digest-toolbar button,
.login-form button,
.feed-form button,
.feed-actions button {
  background: #cc785c;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  padding: 11px 14px;
}

.digest-toolbar button + button,
.feed-actions button {
  background: #faf9f5;
  border: 1px solid #e6dfd8;
  color: #141413;
}

.date-picker {
  display: grid;
  gap: 6px;
}

.date-picker label,
.feed-form label {
  color: #6c6a64;
  font-size: 13px;
  font-weight: 500;
}

input,
.feed-form input,
.date-picker input,
.login-form input {
  background: #faf9f5;
  border: 1px solid #e6dfd8;
  border-radius: 8px;
  color: #141413;
  padding: 10px 12px;
}

input:focus {
  border-color: #cc785c;
  box-shadow: 0 0 0 3px rgba(204, 120, 92, 0.14);
  outline: none;
}

.loading-text,
.digest-meta,
.digest-row p,
.feed-row p,
.run-row p {
  color: #6c6a64;
}

.digest-article,
.markdown,
.notice,
.empty-state,
.feed-row,
.run-row,
.settings-panel,
.login-card {
  background: #fffdf8;
  border: 1px solid #e6dfd8;
  border-radius: 16px;
}

.digest-article {
  padding: 30px;
}

.digest-header {
  border-bottom: 1px solid #ebe6df;
  margin-bottom: 24px;
  padding-bottom: 20px;
}

.digest-header h2 {
  font-size: clamp(32px, 5vw, 48px);
}

.digest-meta {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 1.2px;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.markdown {
  background: #faf9f5;
  color: #3d3d3a;
  line-height: 1.7;
  max-width: 880px;
  padding: 30px;
}

.markdown h1,
.markdown h2,
.markdown h3 {
  color: #141413;
  font-family: "Cormorant Garamond", "EB Garamond", Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.02em;
}

.notice,
.empty-state {
  padding: 20px;
}

.notice-error {
  border-color: #c64545;
  color: #8b2f25;
}

.login-wrap {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.login-card {
  max-width: 560px;
  padding: 36px;
  width: 100%;
}

.login-card p {
  color: #3d3d3a;
  line-height: 1.55;
}

.login-form {
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr auto;
  margin-top: 18px;
}

.feed-form {
  background: #efe9de;
  border-radius: 16px;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(220px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) auto;
  margin-bottom: 18px;
  padding: 18px;
}

.feed-list,
.run-list {
  display: grid;
  gap: 12px;
}

.feed-row,
.run-row,
.settings-panel {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 18px;
}

.feed-actions {
  display: flex;
  gap: 8px;
}

.status-badge {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
}

.status-completed {
  background: rgba(93, 184, 114, 0.16);
  color: #2f7a42;
}

.status-failed {
  background: rgba(198, 69, 69, 0.16);
  color: #9a2f2f;
}

.status-running {
  background: rgba(232, 165, 90, 0.18);
  color: #8c5a17;
}

.error-text {
  color: #c64545;
}

.back-link {
  color: #cc785c;
  display: inline-block;
  margin-bottom: 16px;
}

@media (max-width: 760px) {
  .menu-button {
    left: 16px;
    top: 16px;
  }

  .main-panel {
    padding: 72px 18px 32px;
  }

  .digest-article,
  .markdown,
  .login-card {
    padding: 22px;
  }

  .login-form,
  .feed-form {
    grid-template-columns: 1fr;
  }

  .feed-row,
  .run-row,
  .settings-panel {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
}
```

- [ ] **Step 2: Run focused app tests**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS. CSS should not break behavior tests.

- [ ] **Step 3: Commit style pass**

Run:

```bash
git add src/styles.css
git commit -m "apply editorial visual system"
```

## Task 5: Full Verification

**Files:**
- No new files unless verification exposes required fixes.

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS with all `src/App.test.tsx` tests passing.

- [ ] **Step 2: Run full tests**

Run: `npm run test`

Expected: PASS with all Vitest tests passing.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully. A Vite chunk-size warning is acceptable if build exits successfully, because it existed before this redesign.

- [ ] **Step 4: Review final diff for scope**

Run: `git diff --stat HEAD~4..HEAD`

Expected: changed files are limited to `.gitignore`, `src/App.test.tsx`, `src/components/AppShell.tsx`, `src/pages/DigestsPage.tsx`, `src/pages/FeedsPage.tsx`, `src/pages/SettingsPage.tsx`, `src/pages/LoginPage.tsx`, and `src/styles.css`.

## Self-Review

- Spec coverage: plan covers hidden drawer, digest-centered reader, whole-app DESIGN.md styling, login/feeds/settings visual updates, tests, and verification.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation steps remain.
- Type consistency: `navOpen`, `closeNav`, `page-shell`, `page-kicker`, `page-title`, `digest-article`, and drawer accessible names are consistent across tasks and tests.
