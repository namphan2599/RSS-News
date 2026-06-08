# Reddit Feeds Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Reddit summary RSS source management from generic `feeds` to dedicated `reddit_feeds`.

**Architecture:** Add a Reddit-only Supabase table, migrate existing Reddit feed rows into it, and remap Reddit post summary foreign keys. Update the Edge Function to query and update `reddit_feeds` while keeping summary rows and response shape stable.

**Tech Stack:** Supabase migrations, Deno Edge Functions, TypeScript tests.

---

## File Structure

- Create: `supabase/migrations/202606080001_reddit_feeds.sql` for table, RLS, migration copy/remap, FK replacement.
- Modify: `supabase/functions/reddit-summary/index.ts` so handler reads and updates `reddit_feeds`.
- Modify: `supabase/functions/reddit-summary/index.test.ts` so fake Supabase and assertions use `reddit_feeds`.

### Task 1: Update Edge Function Tests

**Files:**
- Modify: `supabase/functions/reddit-summary/index.test.ts`

- [ ] **Step 1: Change fake Supabase source table**

Replace the `if (table === "feeds")` branch with `if (table === "reddit_feeds")` and keep the same select/update behavior.

- [ ] **Step 2: Update test fixtures**

Keep feed objects shaped as `{ id, subreddit, url }`. The handler no longer depends on `title`.

- [ ] **Step 3: Assert table usage**

In handler tests, assert recorded select/update calls use `reddit_feeds` and upserts still use `reddit_post_summaries`.

- [ ] **Step 4: Run failing tests**

Run: `deno test supabase/functions/reddit-summary/index.test.ts`

Expected before implementation: tests fail because current handler still queries `feeds`.

### Task 2: Implement Handler Table Switch

**Files:**
- Modify: `supabase/functions/reddit-summary/index.ts`

- [ ] **Step 1: Rename row type fields**

Keep `FeedRow` with `id`, `subreddit`, and `url`. Remove unused `title`.

- [ ] **Step 2: Query `reddit_feeds`**

Change `.from("feeds")` to `.from("reddit_feeds")` and select `id,subreddit,url`.

- [ ] **Step 3: Preserve URL validation**

Keep `extractRedditFeedInfo(feed.url)` in the loop. Use parsed subreddit from URL for safety and consistency.

- [ ] **Step 4: Update status writes**

Change both success and failure updates from `feeds` to `reddit_feeds`.

- [ ] **Step 5: Run focused tests**

Run: `deno test supabase/functions/reddit-summary/index.test.ts`

Expected: all tests pass.

### Task 3: Add Supabase Migration

**Files:**
- Create: `supabase/migrations/202606080001_reddit_feeds.sql`

- [ ] **Step 1: Create `reddit_feeds` table**

Include `id`, `owner_id`, `subreddit`, `url`, `is_active`, `last_fetched_at`, `last_error`, `created_at`, `updated_at`, `unique (owner_id, subreddit)`, and unique `url`.

- [ ] **Step 2: Add trigger, RLS, policies, indexes**

Use existing `public.set_updated_at()` and owner-style policies matching `feeds`.

- [ ] **Step 3: Copy existing Reddit feed rows**

Insert rows from `public.feeds` where URL matches Reddit RSS patterns supported by `extractRedditFeedInfo`.

- [ ] **Step 4: Remap existing summary rows and replace FK**

Update `reddit_post_summaries.feed_id` from old `feeds.id` to new `reddit_feeds.id`, then drop old FK and add a new FK to `reddit_feeds(id)`.

### Task 4: Verify

**Files:**
- Test: `supabase/functions/reddit-summary/index.test.ts`

- [ ] **Step 1: Run focused Edge Function tests**

Run: `deno test supabase/functions/reddit-summary/index.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Run project lint/build if available and practical**

Run: `npm run lint`

Expected: lint completes without new errors.
