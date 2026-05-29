# All Feeds Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one daily summary from all active feeds and store it in `daily_digests.summary` without markdown storage writes.

**Architecture:** Keep the existing `rss-summary` Edge Function and change it from single-feed query mode to all-active-feeds daily generation mode. Make digest storage columns nullable by migration, update frontend digest detail loading to read summary directly, and keep changes small and local.

**Tech Stack:** Vite, React, TypeScript, Vitest, Supabase, Deno Edge Functions, Gemini API.

---

## File Map

- Create `supabase/migrations/202605290003_make_digest_storage_nullable.sql`: allow new summary-only digest rows.
- Modify `supabase/functions/rss-summary/index.ts`: fetch all active feeds, summarize grouped by category/topic, upsert summary-only digest, update feed fetch status.
- Modify `supabase/functions/rss-summary/index.test.ts`: cover all-feed generation, partial failures, and no storage upload.
- Modify `src/api/digestsApi.ts`: replace `getDigestMarkdown` with `getDigest` returning summary fields.
- Modify `src/api/digestsApi.test.ts`: test direct summary fetch and missing summary behavior.
- Modify `src/pages/DigestDetailPage.tsx`: render title/date/summary directly.
- Modify or remove `src/components/DigestViewer.tsx`: no longer needed for digest detail if markdown is removed.
- Run Deno tests, Vitest, lint, and build.

Do not commit unless the user explicitly asks.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/202605290003_make_digest_storage_nullable.sql`

- [ ] **Step 1: Add migration**

Create `supabase/migrations/202605290003_make_digest_storage_nullable.sql`:

```sql
alter table public.daily_digests
  alter column storage_bucket drop not null,
  alter column storage_path drop not null;
```

- [ ] **Step 2: Verify migration syntax by inspection**

Confirm it only relaxes nullability and does not remove old values or policies.

---

### Task 2: Edge Function Tests For All-Feed Summary

**Files:**
- Modify: `supabase/functions/rss-summary/index.test.ts`

- [ ] **Step 1: Replace fake Supabase with query/update support**

Update `createFakeSupabase` so `feeds` supports `select().eq().eq()` returning active feeds, `feeds.update(...).eq("id", id)` records status updates, `digest_runs.insert(...).select().single()` returns `run-1`, and `daily_digests.upsert(...).select().single()` returns `digest-1`. Do not include `storage` in the fake client for the all-feed tests; storage access should fail if called.

```ts
function createFakeSupabase(calls: unknown[], feeds: unknown[]) {
  return {
    from: (table: string) => {
      if (table === "feeds") {
        return {
          select: (columns: string) => ({
            eq: (column: string, value: unknown) => ({
              eq: (secondColumn: string, secondValue: unknown) => {
                calls.push({ table, operation: "select", columns, filters: [[column, value], [secondColumn, secondValue]] });
                return Promise.resolve({ data: feeds, error: null });
              },
            }),
          }),
          update: (row: unknown) => ({
            eq: (column: string, value: unknown) => {
              calls.push({ table, operation: "update", row, filter: [column, value] });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      return {
        insert: (row: unknown) => ({
          select: () => ({
            single: () => {
              calls.push({ table, operation: "insert", row });
              return Promise.resolve({ data: { id: "run-1" }, error: null });
            },
          }),
        }),
        upsert: (row: unknown, options: unknown) => ({
          select: () => ({
            single: () => {
              calls.push({ table, operation: "upsert", row, options });
              return Promise.resolve({ data: { id: "digest-1" }, error: null });
            },
          }),
        }),
      };
    },
  };
}
```

- [ ] **Step 2: Replace single-feed handler test with all-feed success test**

Use two feeds, one categorized and one uncategorized. Assert the response has status `succeeded`, one digest, no `storagePath`, and summary text.

```ts
Deno.test("rss summary handler summarizes all active feeds by topic", async () => {
  const calls: unknown[] = [];
  const feeds = [
    { id: "feed-1", title: "Dev Feed", url: "https://example.com/rss.xml", category: "Programming" },
    { id: "feed-2", title: "Game Feed", url: "https://games.example.com/rss.xml", category: null },
  ];
  const handler = createRssSummaryHandler({
    getEnv: (name) => ({
      GEMINI_API_KEY: "gemini-key",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      OWNER_USER_ID: "owner-1",
    })[name] ?? null,
    createClient: (() => createFakeSupabase(calls, feeds)) as never,
    now: () => new Date("2026-05-29T12:00:00.000Z"),
    fetch: (url, init) => {
      if (String(url) === "https://example.com/rss.xml") return Promise.resolve(new Response(rssFeed));
      if (String(url) === "https://games.example.com/rss.xml") return Promise.resolve(new Response(atomFeed));

      assertEquals(String(url).includes("generativelanguage.googleapis.com"), true);
      assertEquals(init?.method, "POST");
      return Promise.resolve(Response.json({
        candidates: [{ content: { parts: [{ text: "Programming\n- Dev updates.\n\nGames\n- Game updates." }] } }],
      }));
    },
  });

  const response = await handler(new Request("https://example.com/rss-summary"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    digestId: "digest-1",
    runId: "run-1",
    status: "succeeded",
    feedCount: 2,
    failedFeedCount: 0,
    itemCount: 3,
    summary: "Programming\n- Dev updates.\n\nGames\n- Game updates.",
  });
  assertEquals(calls.some((call) => JSON.stringify(call).includes("upload")), false);
});
```

- [ ] **Step 3: Add partial failure test**

Add a test with one feed returning HTTP 500 and one feed returning items. Assert run status `partial`, `failedFeedCount: 1`, successful feed update clears `last_error`, failed feed update stores an error, and digest upsert still happens.

- [ ] **Step 4: Run Edge Function tests and confirm failure**

Run:

```bash
deno test --allow-env supabase/functions/rss-summary/index.test.ts
```

Expected before implementation: failing tests due current handler requiring no feed table query and still returning single-feed shape.

---

### Task 3: Edge Function Implementation

**Files:**
- Modify: `supabase/functions/rss-summary/index.ts`

- [ ] **Step 1: Extend item/feed types**

Replace `FeedItem` with source-aware fields and add `FeedRow`.

```ts
type FeedRow = {
  id: string;
  title: string | null;
  url: string;
  category: string | null;
};

type FeedItem = {
  title: string;
  url: string;
  content: string;
  feedId: string;
  feedTitle: string | null;
  feedUrl: string;
  category: string | null;
};
```

- [ ] **Step 2: Remove markdown helpers**

Delete `digestStoragePath`, old `digestTitle(feedUrl)`, and `renderMarkdown`. Add daily title helper.

```ts
function digestTitle(date: string): string {
  return `Daily RSS Digest: ${date}`;
}
```

- [ ] **Step 3: Keep parser pure and attach feed metadata after parsing**

Keep `parseRssItem`, `parseAtomEntry`, and `parseFeedItems` returning basic items, then map parsed items per feed:

```ts
const parsedItems = parseFeedItems(xml, limit).map((item) => ({
  ...item,
  feedId: feed.id,
  feedTitle: feed.title,
  feedUrl: feed.url,
  category: feed.category,
}));
```

- [ ] **Step 4: Replace prompt builder**

Update prompt to request grouped summary by category/topic and inference only for missing categories.

```ts
function buildPrompt(items: FeedItem[]): string {
  return [
    "Summarize these RSS items into one daily digest grouped by topic/category.",
    "Use the provided category when present.",
    "When category is null or empty, infer a concise topic from the feed title and item content.",
    "Use clear topic headings like Tech, Programming, Games, Food.",
    "Keep the digest concise and factual.",
    "Include source context only when it helps distinguish items.",
    "",
    JSON.stringify(items),
  ].join("\n");
}
```

- [ ] **Step 5: Query active feeds**

Inside handler, create Supabase client before fetching feeds and query active owner feeds.

```ts
const supabase = deps.createClient(
  requiredEnv(deps, "SUPABASE_URL"),
  requiredEnv(deps, "SUPABASE_SERVICE_ROLE_KEY"),
);
const { data: feeds, error: feedsError } = await supabase
  .from("feeds")
  .select("id,title,url,category")
  .eq("owner_id", ownerId)
  .eq("is_active", true);
if (feedsError) throw new Error(feedsError.message);
if (!feeds || feeds.length === 0) {
  return jsonResponse({ error: "No active feeds found" }, 400);
}
```

- [ ] **Step 6: Fetch feeds independently**

For each feed, fetch, parse, update status, and record failures without throwing if other feeds can continue.

```ts
const allItems: FeedItem[] = [];
const failures: { feed_id: string; feed_url: string; error: string }[] = [];

for (const feed of feeds as FeedRow[]) {
  try {
    const feedUrl = validateFeedUrl(feed.url);
    const feedResponse = await deps.fetch(feedUrl, { headers: { "User-Agent": "RSS News Summary/0.1" } });
    if (!feedResponse.ok) throw new Error(`RSS request failed with status ${feedResponse.status}`);

    const xml = await feedResponse.text();
    allItems.push(...parseFeedItems(xml, limit).map((item) => ({
      ...item,
      feedId: feed.id,
      feedTitle: feed.title,
      feedUrl,
      category: feed.category,
    })));
    await supabase.from("feeds").update({ last_fetched_at: now.toISOString(), last_error: null }).eq("id", feed.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ feed_id: feed.id, feed_url: feed.url, error: message });
    await supabase.from("feeds").update({ last_error: message }).eq("id", feed.id);
  }
}
```

- [ ] **Step 7: Save run and digest without storage**

Replace `saveDigest` with a function that accepts Supabase client, digest date, status, counts, failures, items, and summary. It inserts `digest_runs`, then upserts `daily_digests` with `storage_bucket: null` and `storage_path: null`.

```ts
const status = failures.length > 0 ? "partial" : "succeeded";
const { data: run, error: runError } = await supabase.from("digest_runs")
  .insert({
    owner_id: ownerId,
    run_date: digestDate,
    status,
    finished_at: now.toISOString(),
    feed_count: feeds.length,
    failed_feed_count: failures.length,
    item_count: allItems.length,
    selected_item_count: allItems.length,
    ai_provider: "gemini",
    ai_model: model,
    metadata: { failures },
  })
  .select("id")
  .single();
if (runError) throw new Error(runError.message);

const { data: digest, error: digestError } = await supabase.from("daily_digests")
  .upsert({
    owner_id: ownerId,
    digest_date: digestDate,
    storage_bucket: null,
    storage_path: null,
    title,
    summary,
    item_count: allItems.length,
    run_id: run.id,
  }, { onConflict: "owner_id,digest_date" })
  .select("id")
  .single();
if (digestError) throw new Error(digestError.message);
```

- [ ] **Step 8: Run Edge Function tests**

Run:

```bash
deno test --allow-env supabase/functions/rss-summary/index.test.ts
```

Expected: all tests pass.

---

### Task 4: Frontend API Tests And Implementation

**Files:**
- Modify: `src/api/digestsApi.test.ts`
- Modify: `src/api/digestsApi.ts`

- [ ] **Step 1: Replace markdown API test**

Update test import and mocks to test `getDigest`.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDigest } from "./digestsApi";

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const fromTable = vi.fn(() => ({ select }));
  return { eq, fromTable, select, single };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: { from: mocks.fromTable },
}));

describe("getDigest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches a digest summary by date", async () => {
    mocks.single.mockResolvedValue({
      data: {
        id: "digest-1",
        digest_date: "2026-05-29",
        title: "Daily RSS Digest: 2026-05-29",
        summary: "Programming\n- Dev updates.",
        item_count: 2,
        generated_at: "2026-05-29T12:00:00.000Z",
      },
      error: null,
    });

    await expect(getDigest("2026-05-29")).resolves.toEqual({
      id: "digest-1",
      digest_date: "2026-05-29",
      title: "Daily RSS Digest: 2026-05-29",
      summary: "Programming\n- Dev updates.",
      item_count: 2,
      generated_at: "2026-05-29T12:00:00.000Z",
    });
    expect(mocks.fromTable).toHaveBeenCalledWith("daily_digests");
    expect(mocks.select).toHaveBeenCalledWith("id,digest_date,title,summary,item_count,generated_at");
    expect(mocks.eq).toHaveBeenCalledWith("digest_date", "2026-05-29");
  });
});
```

- [ ] **Step 2: Run API test and confirm failure**

Run:

```bash
npm run test -- src/api/digestsApi.test.ts
```

Expected before implementation: failure because `getDigest` is not exported.

- [ ] **Step 3: Implement `getDigest` and remove storage fetch**

Update `src/api/digestsApi.ts`:

```ts
export async function getDigest(date: string): Promise<DailyDigest> {
  const { data, error } = await supabase
    .from("daily_digests")
    .select("id,digest_date,title,summary,item_count,generated_at")
    .eq("digest_date", date)
    .single();
  if (error) throw error;
  return data;
}
```

Remove `getDigestMarkdown`.

- [ ] **Step 4: Run API test**

Run:

```bash
npm run test -- src/api/digestsApi.test.ts
```

Expected: pass.

---

### Task 5: Frontend Detail Page Summary Rendering

**Files:**
- Modify: `src/pages/DigestDetailPage.tsx`
- Modify or delete: `src/components/DigestViewer.tsx`
- Modify: `src/App.test.tsx` if route tests need updated mocked API shape.

- [ ] **Step 1: Update detail page**

Replace markdown state with digest state and render plain text summary.

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDigest, type DailyDigest } from "../api/digestsApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";

export function DigestDetailPage() {
  const { date } = useParams();
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    getDigest(date)
      .then(setDigest)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <section>
      <Link to="/digests" className="back-link">
        Back to digests
      </Link>
      {loading && <p>Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && digest && (
        <article>
          <h1>{digest.title}</h1>
          <p>{digest.digest_date}</p>
          {digest.summary ? (
            <div className="digest-summary">{digest.summary}</div>
          ) : (
            <EmptyState title="No summary available" body="This digest does not have a stored summary." />
          )}
        </article>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Remove unused markdown viewer if no imports remain**

Search for `DigestViewer`. If only old detail page imported it, delete `src/components/DigestViewer.tsx`. Keep `MarkdownRenderer` only if other code imports it; otherwise leave cleanup for a separate dependency cleanup task.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
npm run test
```

Expected: pass or reveal `App.test.tsx` mock updates needed.

- [ ] **Step 4: Update test mocks if needed**

If `App.test.tsx` mocks `getDigestMarkdown`, replace with `getDigest` returning a `DailyDigest` object. Keep unrelated route assertions unchanged.

---

### Task 6: Final Verification

**Files:**
- No planned edits unless verification finds issues.

- [ ] **Step 1: Run Edge Function tests**

Run:

```bash
deno test --allow-env supabase/functions/rss-summary/index.test.ts
```

Expected: pass.

- [ ] **Step 2: Run Vitest**

Run:

```bash
npm run test
```

Expected: pass.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 5: Report result**

Summarize changed files, verification commands, and any remaining risks. Do not claim complete unless all verification commands either pass or are explicitly documented as unable to run.
