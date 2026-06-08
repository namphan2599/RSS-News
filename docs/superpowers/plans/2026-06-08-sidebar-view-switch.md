# Sidebar View Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sidebar Digest/Reddit tab switching, sidebar digest date controls, reader-only digest content, and date-grouped Reddit posts.

**Architecture:** `AppShell` owns current digest date and navigation because controls live in the sidebar. `DigestsPage` loads the selected date passed by route state. `RedditNewsPage` keeps its existing data load and groups rendered posts by `summary_date`.

**Tech Stack:** Vite, React, TypeScript, React Router, Vitest, Testing Library, Supabase API wrappers.

---

## File Structure

- Modify `src/components/AppShell.tsx`: add route-aware segmented tabs, date helpers, sidebar date controls, and `Outlet` context.
- Modify `src/pages/DigestsPage.tsx`: read selected date from outlet context, remove page header and old toolbar, render markdown directly.
- Modify `src/pages/RedditNewsPage.tsx`: group post buttons by `summary_date` and remove old digest backlink.
- Modify `src/App.tsx`: keep `/digests/:date` route and make `/digests` use current date through `AppShell` state.
- Modify `src/styles.css`: add segmented tab and sidebar date-control styles; adjust digest reader styles.
- Modify `src/App.test.tsx`: update assertions for sidebar tabs, digest sidebar controls, reader-only digest, and Reddit date grouping.

## Task 1: Sidebar Tabs And Date Controls

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests**

In `src/App.test.tsx`, update shell navigation expectations:

```tsx
expect(screen.getByRole("link", { name: "Digest" })).toHaveAttribute("href", "/digests/2026-05-29");
expect(screen.getByRole("link", { name: "Reddit" })).toHaveAttribute("href", "/reddit");
expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
expect(screen.getByLabelText("Digest date")).toHaveValue("2026-05-29");
```

Add route switch assertion:

```tsx
expect(screen.getByRole("link", { name: "Digest" })).toHaveClass("is-active");
expect(screen.getByRole("link", { name: "Reddit" })).not.toHaveClass("is-active");
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because `Digest`/`Reddit` tabs and sidebar date input do not exist.

- [ ] **Step 3: Implement sidebar state and navigation**

In `src/components/AppShell.tsx`, add `useLocation`, `useNavigate`, `useParams` equivalent via route path parsing if needed, date helpers, and `Outlet` context:

```tsx
type AppShellContext = {
  selectedDigestDate: string;
};
```

Use `useLocation()` to detect active digest or reddit route. Use `useNavigate()` when Previous, Next, or date input changes:

```tsx
navigate(`/digests/${nextDate}`);
```

Render segmented tabs:

```tsx
<div className="view-tabs" aria-label="View switch">
  <NavLink className={({ isActive }) => `view-tab${isActive ? " is-active" : ""}`} to={`/digests/${selectedDigestDate}`}>Digest</NavLink>
  <NavLink className={({ isActive }) => `view-tab${isActive ? " is-active" : ""}`} to="/reddit">Reddit</NavLink>
</div>
```

Render sidebar date controls only on digest routes.

- [ ] **Step 4: Style sidebar controls**

In `src/styles.css`, add `.view-tabs`, `.view-tab`, `.sidebar-date-controls`, and `.sidebar-date-actions` using existing card, hairline, primary, rounded patterns.

- [ ] **Step 5: Run tests**

Run: `npm run test -- src/App.test.tsx`

Expected: tests from this task pass or fail only on digest page changes handled in Task 2.

## Task 2: Reader-Only Digest Page

**Files:**
- Modify: `src/pages/DigestsPage.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Update digest tests to expect markdown content without old page chrome:

```tsx
expect(await screen.findByRole("heading", { name: "Programming" })).toBeInTheDocument();
expect(screen.queryByRole("heading", { name: "Daily Digest" })).not.toBeInTheDocument();
expect(screen.queryByText("A focused reader for the selected day's feed summary.")).not.toBeInTheDocument();
expect(screen.queryByText(/2026-05-29 · 3 items/)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because old digest header and article chrome still render.

- [ ] **Step 3: Implement minimal digest page props/context**

In `src/pages/DigestsPage.tsx`, use `useOutletContext<{ selectedDigestDate: string }>()`. Remove local date state and old `Link`, title, intro, and toolbar.

Render:

```tsx
{showDigest && (
  digest.summary ? (
    <DigestViewer markdown={digest.summary} />
  ) : (
    <EmptyState title="No summary available" body="This digest does not have a stored summary." />
  )
)}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/App.test.tsx`

Expected: digest page tests pass.

## Task 3: Reddit Posts Grouped By Date

**Files:**
- Modify: `src/pages/RedditNewsPage.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests**

In Reddit page test, assert date group headings appear:

```tsx
expect(await screen.findByRole("heading", { name: "2026-06-05" })).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "2026-06-04" })).toBeInTheDocument();
```

Assert old backlink is removed:

```tsx
expect(screen.queryByRole("link", { name: "Back to Daily Digest" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/App.test.tsx`

Expected: FAIL because posts are not grouped under date headings yet.

- [ ] **Step 3: Implement grouping inline**

In `RedditNewsPage.tsx`, build grouped dates with `reduce` or a small local loop:

```tsx
const postsByDate = posts.reduce<Record<string, RedditPostSummary[]>>((groups, post) => {
  groups[post.summary_date] = groups[post.summary_date] ?? [];
  groups[post.summary_date].push(post);
  return groups;
}, {});
const postDates = Object.keys(postsByDate);
```

Render each date heading before its post buttons.

- [ ] **Step 4: Add minimal styles**

In `src/styles.css`, add `.reddit-date-group` and `.reddit-date-heading` matching existing muted uppercase metadata.

- [ ] **Step 5: Run tests**

Run: `npm run test -- src/App.test.tsx`

Expected: Reddit grouping tests pass.

## Task 4: Verification

**Files:**
- No code changes unless verification reveals failures.

- [ ] **Step 1: Run focused test suite**

Run: `npm run test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Report changed files**

Run: `git diff --stat`

Expected: changes limited to approved files plus spec/plan and visual companion artifacts if not ignored.

## Self-Review

- Spec coverage: sidebar tabs, sidebar digest date controls, reader-only digest content, Reddit grouping, and tests are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: `selectedDigestDate` is used consistently as a `string` in `AppShell` outlet context and `DigestsPage`.
