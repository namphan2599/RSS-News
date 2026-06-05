# Reddit Sidebar Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-pane Reddit reader with a left post list and right markdown summary viewer.

**Architecture:** Keep the feature inside `RedditNewsPage` because the current page is small and the behavior is local. Reuse `listRedditPostSummaries()` for data and `MarkdownRenderer` for safe markdown rendering. Add focused CSS classes to `styles.css` for desktop split layout and mobile stacking.

**Tech Stack:** Vite, React, TypeScript, React Router, React Testing Library, Vitest, `react-markdown` through existing `MarkdownRenderer`.

---

## File Structure

- Modify `src/pages/RedditNewsPage.tsx`: add selected post state, render sidebar buttons, render selected summary through `MarkdownRenderer`.
- Modify `src/styles.css`: replace old Reddit card list styles with split reader, sidebar item, selected state, and responsive stacking styles.
- Modify `src/App.test.tsx`: update `/reddit` test to cover default selection and click-to-select behavior.

---

### Task 1: Cover Default Selection And Click Behavior

**Files:**
- Modify: `src/App.test.tsx:197-226`

- [ ] **Step 1: Update imports for user interactions**

In `src/App.test.tsx`, add this import near the existing testing-library imports:

```ts
import userEvent from "@testing-library/user-event";
```

- [ ] **Step 2: Replace the current Reddit page test with interaction coverage**

Replace the test beginning at `it("renders public Reddit news page", async () => {` with:

```tsx
  it("renders Reddit post list and selected markdown summary", async () => {
    const user = userEvent.setup();

    redditPostsApiMock.listRedditPostSummaries.mockResolvedValue([
      {
        id: "post-1",
        summary_date: "2026-06-05",
        subreddit: "programming",
        title: "First Reddit Post",
        url: "https://www.reddit.com/r/programming/comments/abc123/first_reddit_post/",
        summary: "## First summary\n\n- Tóm tắt tiếng Việt.",
        published_at: "2026-06-05T01:30:00.000Z",
        fetched_at: "2026-06-05T02:00:00.000Z",
      },
      {
        id: "post-2",
        summary_date: "2026-06-04",
        subreddit: "technology",
        title: "Second Reddit Post",
        url: "https://www.reddit.com/r/technology/comments/def456/second_reddit_post/",
        summary: "## Second summary\n\n- Another Vietnamese summary.",
        published_at: "2026-06-04T03:15:00.000Z",
        fetched_at: "2026-06-04T04:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/reddit"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Reddit News" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /First Reddit Post/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Second Reddit Post/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { name: "First Reddit Post" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First summary" })).toBeInTheDocument();
    expect(screen.getByText("Tóm tắt tiếng Việt.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Reddit post" })).toHaveAttribute(
      "href",
      "https://www.reddit.com/r/programming/comments/abc123/first_reddit_post/",
    );

    await user.click(screen.getByRole("button", { name: /Second Reddit Post/ }));

    expect(screen.getByRole("button", { name: /First Reddit Post/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Second Reddit Post/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Second Reddit Post" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Second summary" })).toBeInTheDocument();
    expect(screen.getByText("Another Vietnamese summary.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Reddit post" })).toHaveAttribute(
      "href",
      "https://www.reddit.com/r/technology/comments/def456/second_reddit_post/",
    );
  });
```

- [ ] **Step 3: Run focused test to confirm it fails**

Run:

```bash
npm run test -- src/App.test.tsx --runInBand
```

Expected: FAIL because the Reddit page still renders all summaries as cards instead of a selected markdown summary and sidebar buttons.

---

### Task 2: Implement Reader Behavior And Layout Markup

**Files:**
- Modify: `src/pages/RedditNewsPage.tsx`

- [ ] **Step 1: Import the markdown renderer**

Add this import:

```ts
import { MarkdownRenderer } from "../components/MarkdownRenderer";
```

- [ ] **Step 2: Add selected post state**

Inside `RedditNewsPage`, after the posts state line, add:

```ts
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
```

- [ ] **Step 3: Select first loaded post by date order**

Replace the current successful load handler:

```ts
      .then((nextPosts) => {
        if (active) setPosts(nextPosts);
      })
```

with:

```ts
      .then((nextPosts) => {
        if (!active) return;
        setPosts(nextPosts);
        setSelectedPostId(nextPosts[0]?.id ?? null);
      })
```

- [ ] **Step 4: Derive selected post before return**

Before the `return (` statement, add:

```ts
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? posts[0] ?? null;
```

- [ ] **Step 5: Replace loaded Reddit list markup**

Replace the block:

```tsx
      {!loading && !error && posts.length > 0 && (
        <div className="reddit-list">
          {posts.map((post) => {
            const publishedTime = formatPublishedTime(post.published_at);

            return (
              <article className="reddit-card" key={post.id}>
                <div className="reddit-card-meta">
                  <span className="reddit-subreddit">r/{post.subreddit}</span>
                  <span>{post.summary_date}</span>
                  {publishedTime && <span>{publishedTime}</span>}
                </div>
                <h2>{post.title}</h2>
                <p>{post.summary}</p>
                <a href={post.url} target="_blank" rel="noreferrer">Open Reddit post</a>
              </article>
            );
          })}
        </div>
      )}
```

with:

```tsx
      {!loading && !error && selectedPost && (
        <div className="reddit-reader">
          <aside className="reddit-sidebar" aria-label="Reddit posts">
            <h2>Posts</h2>
            <div className="reddit-post-list">
              {posts.map((post) => {
                const publishedTime = formatPublishedTime(post.published_at);
                const selected = post.id === selectedPost.id;

                return (
                  <button
                    aria-pressed={selected}
                    className={`reddit-post-item${selected ? " is-selected" : ""}`}
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    type="button"
                  >
                    <span className="reddit-card-meta">
                      <span className="reddit-subreddit">r/{post.subreddit}</span>
                      <span>{post.summary_date}</span>
                    </span>
                    <span className="reddit-post-title">{post.title}</span>
                    {publishedTime && <span className="reddit-post-time">{publishedTime}</span>}
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="reddit-summary-panel">
            <div className="reddit-summary-header">
              <div className="reddit-card-meta">
                <span className="reddit-subreddit">r/{selectedPost.subreddit}</span>
                <span>{selectedPost.summary_date}</span>
                {formatPublishedTime(selectedPost.published_at) && (
                  <span>{formatPublishedTime(selectedPost.published_at)}</span>
                )}
              </div>
              <h2>{selectedPost.title}</h2>
              <a href={selectedPost.url} target="_blank" rel="noreferrer">Open Reddit post</a>
            </div>
            <MarkdownRenderer markdown={selectedPost.summary} />
          </article>
        </div>
      )}
```

- [ ] **Step 6: Run focused test**

Run:

```bash
npm run test -- src/App.test.tsx --runInBand
```

Expected: PASS for the Reddit test. If command fails because Vitest does not support `--runInBand`, run `npm run test -- src/App.test.tsx` instead.

---

### Task 3: Add Reader Styling

**Files:**
- Modify: `src/styles.css:490-539`

- [ ] **Step 1: Replace old Reddit card styles**

Replace the CSS block from `.reddit-list` through `.reddit-card a` with:

```css
.reddit-reader {
  align-items: start;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(240px, 320px) 1fr;
}

.reddit-sidebar,
.reddit-summary-panel {
  background: var(--color-card);
  border: 1px solid var(--color-hairline);
  border-radius: 16px;
}

.reddit-sidebar {
  max-height: calc(100vh - 140px);
  overflow: auto;
  padding: 16px;
  position: sticky;
  top: 72px;
}

.reddit-sidebar h2 {
  color: var(--color-ink);
  font-size: 14px;
  letter-spacing: 1.2px;
  margin: 0 0 12px;
  text-transform: uppercase;
}

.reddit-post-list {
  display: grid;
  gap: 10px;
}

.reddit-post-item {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  color: inherit;
  display: grid;
  gap: 8px;
  padding: 12px;
  text-align: left;
  width: 100%;
}

.reddit-post-item:hover,
.reddit-post-item.is-selected {
  background: var(--color-canvas);
  border-color: var(--color-hairline);
}

.reddit-post-item.is-selected {
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.reddit-post-title {
  color: var(--color-ink);
  font-weight: 700;
  line-height: 1.3;
}

.reddit-post-time {
  color: var(--color-muted);
  font-size: 13px;
}

.reddit-card-meta {
  align-items: center;
  color: var(--color-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 8px;
}

.reddit-subreddit {
  background: var(--color-warning-bg);
  border-radius: 999px;
  color: var(--color-warning-text);
  font-weight: 700;
  padding: 4px 10px;
}

.reddit-summary-panel {
  min-width: 0;
  padding: 28px;
}

.reddit-summary-header {
  border-bottom: 1px solid var(--color-hairline-soft);
  margin-bottom: 22px;
  padding-bottom: 18px;
}

.reddit-summary-header h2 {
  color: var(--color-ink);
  font-family: "Cormorant Garamond", "EB Garamond", Georgia, serif;
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.12;
  margin: 12px 0;
}

.reddit-summary-header a {
  color: var(--color-primary);
  font-weight: 600;
}
```

- [ ] **Step 2: Add mobile stacking styles**

Inside the existing `@media (max-width: 760px)` block, add:

```css
  .reddit-reader {
    grid-template-columns: 1fr;
  }

  .reddit-sidebar {
    max-height: none;
    position: static;
  }

  .reddit-summary-panel {
    padding: 20px;
  }
```

- [ ] **Step 3: Run lint and focused test**

Run:

```bash
npm run lint
npm run test -- src/App.test.tsx
```

Expected: both commands PASS.

---

### Task 4: Final Verification

**Files:**
- Verify: `src/pages/RedditNewsPage.tsx`
- Verify: `src/styles.css`
- Verify: `src/App.test.tsx`

- [ ] **Step 1: Run full build**

Run:

```bash
npm run build
```

Expected: PASS with TypeScript and Vite build completing.

- [ ] **Step 2: Review diff for scope**

Run:

```bash
git diff -- src/pages/RedditNewsPage.tsx src/styles.css src/App.test.tsx docs/superpowers/specs/2026-06-05-reddit-sidebar-reader-design.md docs/superpowers/plans/2026-06-05-reddit-sidebar-reader.md
```

Expected: diff only includes Reddit reader code, CSS, tests, and design/plan docs.

- [ ] **Step 3: Commit only if explicitly requested**

Do not commit unless user asks. If requested, use:

```bash
git add src/pages/RedditNewsPage.tsx src/styles.css src/App.test.tsx docs/superpowers/specs/2026-06-05-reddit-sidebar-reader-design.md docs/superpowers/plans/2026-06-05-reddit-sidebar-reader.md
git commit -m "feat: add reddit sidebar reader"
```

---

## Self-Review

- Spec coverage: default first post selection, click-to-select, markdown viewer, preserved loading/error/empty states, responsive layout, and no routing/schema changes are covered.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: uses existing `RedditPostSummary`, existing snake_case fields, existing `MarkdownRenderer`, and local `selectedPostId` state consistently.
