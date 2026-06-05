# Reddit Post Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build public Reddit news summaries by fetching configured Reddit RSS feeds, summarizing each new post in Vietnamese, saving summaries to Supabase, and rendering them at `/reddit`.

**Architecture:** Reuse `feeds` as the source of Reddit RSS URLs. Add `reddit_post_summaries` plus a public read view, a dedicated `reddit-summary` Edge Function, and a small frontend API/page. Keep changes narrow and aligned with existing RSS/Gemini/Supabase patterns.

**Tech Stack:** Vite, React, TypeScript, Supabase Postgres/RLS/views, Supabase Edge Functions on Deno, Gemini API, Vitest, Deno tests.

---

## File Structure

- Create `supabase/migrations/202606050001_reddit_post_summaries.sql`: table, indexes, RLS, public view, grants.
- Create `supabase/functions/reddit-summary/index.ts`: Reddit feed detection, RSS/Atom parsing, Gemini summarization, Supabase upsert handler.
- Create `supabase/functions/reddit-summary/index.test.ts`: Deno tests for parser, prompt, date, skip, save, partial failure.
- Create `src/api/redditPostsApi.ts`: typed Supabase query for public Reddit summary view.
- Create `src/api/redditPostsApi.test.ts`: Vitest query-chain test.
- Create `src/pages/RedditNewsPage.tsx`: public Reddit news list page.
- Modify `src/App.tsx`: add `/reddit` route.
- Modify `src/pages/DigestsPage.tsx`: add link to `/reddit`.
- Modify `src/styles.css`: add Reddit list/card styles using existing tokens.
- Modify `src/App.test.tsx`: mock Reddit API and add `/reddit` route test.

## Task 1: Add Supabase Schema

**Files:**
- Create: `supabase/migrations/202606050001_reddit_post_summaries.sql`

- [ ] **Step 1: Create migration**

Add this file:

```sql
create table public.reddit_post_summaries (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subreddit text not null,
  reddit_post_id text not null,
  title text not null,
  url text not null,
  summary text not null,
  summary_date date not null,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  ai_provider text not null default 'gemini',
  ai_model text not null,
  unique (feed_id, reddit_post_id)
);

create index reddit_post_summaries_summary_date_idx
on public.reddit_post_summaries (summary_date desc);

create index reddit_post_summaries_published_at_idx
on public.reddit_post_summaries (published_at desc);

create index reddit_post_summaries_feed_id_idx
on public.reddit_post_summaries (feed_id);

alter table public.reddit_post_summaries enable row level security;

create policy "owner reads reddit post summaries"
on public.reddit_post_summaries for select
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create or replace view public.public_reddit_post_summaries as
select
  id,
  summary_date,
  subreddit,
  title,
  url,
  summary,
  published_at,
  fetched_at
from public.reddit_post_summaries;

revoke all on public.public_reddit_post_summaries from public;
grant usage on schema public to anon, authenticated;
grant select on public.public_reddit_post_summaries to anon, authenticated;
```

- [ ] **Step 2: Review migration by inspection**

Confirm all required columns exist and public view excludes `owner_id`, `feed_id`, AI metadata, and post id.

- [ ] **Step 3: Commit schema change**

Only run commit if user explicitly requested commits for implementation.

```bash
git add supabase/migrations/202606050001_reddit_post_summaries.sql
git commit -m "feat: add reddit post summary schema"
```

## Task 2: Add Reddit Parser And Prompt Tests

**Files:**
- Create: `supabase/functions/reddit-summary/index.test.ts`
- Create: `supabase/functions/reddit-summary/index.ts`

- [ ] **Step 1: Create failing parser/prompt tests**

Create `supabase/functions/reddit-summary/index.test.ts` with:

```ts
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildPrompt,
  extractRedditFeedInfo,
  formatDate,
  parseFeedItems,
  summaryDateForItem,
} from "./index.ts";

const redditAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>t3_abc123</id>
    <title>First Reddit Post</title>
    <link href="https://www.reddit.com/r/programming/comments/abc123/first_reddit_post/" />
    <updated>2026-06-05T01:30:00+00:00</updated>
    <content type="html"><![CDATA[<p>Post body &amp; comments preview</p>]]></content>
  </entry>
  <entry>
    <id>https://www.reddit.com/r/programming/comments/def456/second/</id>
    <title>Second Reddit Post</title>
    <link href="https://www.reddit.com/r/programming/comments/def456/second/" />
    <published>2026-06-04T22:00:00+00:00</published>
    <summary>Short summary</summary>
  </entry>
</feed>`;

Deno.test("extractRedditFeedInfo accepts subreddit RSS URLs", () => {
  assertEquals(extractRedditFeedInfo("https://www.reddit.com/r/programming/.rss"), {
    subreddit: "programming",
    url: "https://www.reddit.com/r/programming/.rss",
  });
  assertEquals(extractRedditFeedInfo("https://reddit.com/r/typescript.rss"), {
    subreddit: "typescript",
    url: "https://reddit.com/r/typescript.rss",
  });
});

Deno.test("extractRedditFeedInfo rejects non-Reddit and unsafe URLs", () => {
  assertEquals(extractRedditFeedInfo("https://example.com/rss.xml"), null);
  assertThrows(() => extractRedditFeedInfo("file:///tmp/rss.xml"), Error, "url must use http or https");
});

Deno.test("parseFeedItems extracts Reddit Atom entries", () => {
  assertEquals(parseFeedItems(redditAtom, 10), [
    {
      redditPostId: "abc123",
      title: "First Reddit Post",
      url: "https://www.reddit.com/r/programming/comments/abc123/first_reddit_post/",
      content: "Post body & comments preview",
      publishedAt: "2026-06-05T01:30:00+00:00",
    },
    {
      redditPostId: "def456",
      title: "Second Reddit Post",
      url: "https://www.reddit.com/r/programming/comments/def456/second/",
      content: "Short summary",
      publishedAt: "2026-06-04T22:00:00+00:00",
    },
  ]);
});

Deno.test("summaryDateForItem uses published date in app timezone", () => {
  assertEquals(
    summaryDateForItem("2026-06-05T22:30:00.000Z", new Date("2026-06-05T12:00:00.000Z"), "Asia/Saigon"),
    "2026-06-06",
  );
  assertEquals(
    summaryDateForItem(null, new Date("2026-06-05T22:30:00.000Z"), "Asia/Saigon"),
    "2026-06-06",
  );
});

Deno.test("buildPrompt asks Gemini for concise Vietnamese factual summary", () => {
  const prompt = buildPrompt({
    subreddit: "programming",
    title: "First Reddit Post",
    url: "https://www.reddit.com/r/programming/comments/abc123/first_reddit_post/",
    content: "Post body",
  });

  assertEquals(prompt.includes("Tóm tắt bài Reddit sau bằng tiếng Việt"), true);
  assertEquals(prompt.includes("r/programming"), true);
  assertEquals(prompt.includes("First Reddit Post"), true);
  assertEquals(prompt.includes("Không bịa thêm chi tiết"), true);
});

Deno.test("formatDate formats date in selected timezone", () => {
  assertEquals(formatDate(new Date("2026-06-05T22:30:00.000Z"), "Asia/Saigon"), "2026-06-06");
});
```

- [ ] **Step 2: Add minimal exported stubs so tests compile and fail on behavior**

Create `supabase/functions/reddit-summary/index.ts` with:

```ts
export type RedditFeedInfo = {
  subreddit: string;
  url: string;
};

export type RedditFeedItem = {
  redditPostId: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
};

export function extractRedditFeedInfo(_feedUrl: string): RedditFeedInfo | null {
  return null;
}

export function parseFeedItems(_xml: string, _limit: number): RedditFeedItem[] {
  return [];
}

export function formatDate(_date: Date, _timeZone: string): string {
  return "";
}

export function summaryDateForItem(_publishedAt: string | null, _now: Date, _timeZone: string): string {
  return "";
}

export function buildPrompt(_item: { subreddit: string; title: string; url: string; content: string }): string {
  return "";
}
```

- [ ] **Step 3: Run parser/prompt tests and verify failure**

Run:

```bash
deno test supabase/functions/reddit-summary/index.test.ts
```

Expected: tests fail because stubs return empty values.

- [ ] **Step 4: Implement parser, date, prompt helpers**

Replace `supabase/functions/reddit-summary/index.ts` with helper implementation:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type RedditFeedInfo = {
  subreddit: string;
  url: string;
};

export type RedditFeedItem = {
  redditPostId: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
};

type HandlerDeps = {
  createClient: typeof createClient;
  fetch: typeof fetch;
  getEnv: (name: string) => string | undefined | null;
  now?: () => Date;
};

type FeedRow = {
  id: string;
  title: string | null;
  url: string;
};

type FeedFailure = {
  feed_id: string;
  feed_url: string;
  error: string;
};

type SourceRedditItem = RedditFeedItem & {
  feedId: string;
  subreddit: string;
};

const defaultLimit = 10;
const maxLimit = 25;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value: string, pattern: RegExp): string {
  return decodeEntities(pattern.exec(value)?.[1]?.trim() ?? "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseLimit(value: string | null): number {
  if (!value) return defaultLimit;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

function requiredEnv(deps: HandlerDeps, name: string): string {
  const value = deps.getEnv(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function extractRedditFeedInfo(feedUrl: string): RedditFeedInfo | null {
  const parsed = new URL(feedUrl.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https");
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "reddit.com" && host !== "www.reddit.com") return null;

  const match = /^\/r\/([^/]+)(?:\/(?:\.rss)?)?$|^\/r\/([^/.]+)\.rss$/i.exec(parsed.pathname);
  const subreddit = match?.[1] ?? match?.[2];
  if (!subreddit) return null;

  return { subreddit, url: parsed.toString() };
}

function postIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return /\/comments\/([^/]+)/i.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function stablePostId(entry: string, url: string): string {
  const id = firstMatch(entry, /<id[^>]*>([\s\S]*?)<\/id>/i);
  const fromUrl = postIdFromUrl(url) ?? postIdFromUrl(id);
  return fromUrl ?? id;
}

function parseAtomEntry(entry: string): RedditFeedItem {
  const url = firstMatch(entry, /<link[^>]+href="([^"]+)"/i);
  return {
    redditPostId: stablePostId(entry, url),
    title: stripTags(firstMatch(entry, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    url,
    content: stripTags(firstMatch(
      entry,
      /<(?:content|summary)[^>]*>([\s\S]*?)<\/(?:content|summary)>/i,
    )),
    publishedAt: firstMatch(entry, /<(?:published|updated)[^>]*>([\s\S]*?)<\/(?:published|updated)>/i) || null,
  };
}

function parseRssItem(item: string): RedditFeedItem {
  const url = firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/i);
  return {
    redditPostId: stablePostId(item, url),
    title: stripTags(firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    url,
    content: stripTags(firstMatch(
      item,
      /<(?:description|content:encoded|summary)[^>]*>([\s\S]*?)<\/(?:description|content:encoded|summary)>/i,
    )),
    publishedAt: firstMatch(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || null,
  };
}

export function parseFeedItems(xml: string, limit: number): RedditFeedItem[] {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items = rssItems.length > 0 ? rssItems.map(parseRssItem) : atomEntries.map(parseAtomEntry);

  return items
    .filter((item) => item.redditPostId && item.title && item.url)
    .slice(0, limit);
}

export function formatDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not format date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function summaryDateForItem(publishedAt: string | null, now: Date, timeZone: string): string {
  const date = publishedAt ? new Date(publishedAt) : now;
  if (Number.isNaN(date.getTime())) return formatDate(now, timeZone);
  return formatDate(date, timeZone);
}

export function buildPrompt(item: { subreddit: string; title: string; url: string; content: string }): string {
  return [
    "Tóm tắt bài Reddit sau bằng tiếng Việt.",
    "Viết 1 đoạn ngắn, rõ ràng, trung lập, không giật tít.",
    "Chỉ dùng thông tin có trong tiêu đề, nội dung RSS, và URL được cung cấp.",
    "Nếu nội dung mỏng hoặc chưa chắc chắn, hãy nói thận trọng.",
    "Không bịa thêm chi tiết.",
    "",
    JSON.stringify({
      subreddit: `r/${item.subreddit}`,
      title: item.title,
      url: item.url,
      content: item.content,
    }),
  ].join("\n");
}

async function summarizeWithGemini(input: {
  apiKey: string;
  model: string;
  item: SourceRedditItem;
  fetch: typeof fetch;
}): Promise<string> {
  const response = await input.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: buildPrompt(input.item) }],
        }],
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.find((part) => part?.thought !== true && typeof part?.text === "string" && part.text.trim())?.text
    : undefined;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini response did not include summary text");
  }

  return text.trim();
}
```

This code intentionally omits the handler. Task 3 adds handler exports below these helpers.

- [ ] **Step 5: Run parser/prompt tests and verify pass for helper tests**

Run:

```bash
deno test supabase/functions/reddit-summary/index.test.ts
```

Expected: PASS for helper tests once no handler tests exist.

- [ ] **Step 6: Commit helper work**

Only run commit if user explicitly requested commits for implementation.

```bash
git add supabase/functions/reddit-summary/index.ts supabase/functions/reddit-summary/index.test.ts
git commit -m "feat: parse reddit rss posts"
```

## Task 3: Add Reddit Summary Handler Tests And Implementation

**Files:**
- Modify: `supabase/functions/reddit-summary/index.test.ts`
- Modify: `supabase/functions/reddit-summary/index.ts`

- [ ] **Step 1: Append failing handler tests**

Append to `supabase/functions/reddit-summary/index.test.ts`:

```ts
import { createRedditSummaryHandler } from "./index.ts";

function createFakeSupabase(calls: unknown[], feeds: unknown[], existingRows: unknown[] = []) {
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

      if (table === "reddit_post_summaries") {
        return {
          select: (columns: string) => ({
            eq: (column: string, value: unknown) => ({
              in: (inColumn: string, values: unknown[]) => {
                calls.push({ table, operation: "select", columns, filter: [column, value], inFilter: [inColumn, values] });
                return Promise.resolve({ data: existingRows, error: null });
              },
            }),
          }),
          upsert: (rows: unknown, options: unknown) => {
            calls.push({ table, operation: "upsert", rows, options });
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`unsupported table ${table}`);
    },
  };
}

Deno.test("reddit summary handler saves new Reddit post summaries", async () => {
  const calls: unknown[] = [];
  const feeds = [
    { id: "feed-1", title: "Programming", url: "https://www.reddit.com/r/programming/.rss" },
    { id: "feed-2", title: "Regular", url: "https://example.com/rss.xml" },
  ];
  const handler = createRedditSummaryHandler({
    getEnv: (name) => ({
      APP_TIMEZONE: "Asia/Saigon",
      GEMINI_API_KEY: "gemini-key",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      OWNER_USER_ID: "owner-1",
    })[name] ?? null,
    createClient: (() => createFakeSupabase(calls, feeds)) as never,
    now: () => new Date("2026-06-05T12:00:00.000Z"),
    fetch: (url, init) => {
      if (String(url) === "https://www.reddit.com/r/programming/.rss") {
        assertEquals((init?.headers as Record<string, string>)["User-Agent"].includes("Mozilla/5.0"), true);
        return Promise.resolve(new Response(redditAtom));
      }

      assertEquals(String(url).includes("generativelanguage.googleapis.com"), true);
      assertEquals(init?.method, "POST");
      assertEquals(String(init?.body).includes("Tóm tắt bài Reddit sau bằng tiếng Việt"), true);
      return Promise.resolve(Response.json({
        candidates: [{ content: { parts: [{ text: "Tóm tắt tiếng Việt." }] } }],
      }));
    },
  });

  const response = await handler(new Request("https://example.com/reddit-summary?limit=2"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    scannedFeedCount: 2,
    redditFeedCount: 1,
    postsFound: 2,
    postsSummarized: 2,
    skippedPosts: 0,
    failedFeedCount: 0,
    failures: [],
  });

  const upsert = calls.find((call) => {
    const record = call as { table?: unknown; operation?: unknown };
    return record.table === "reddit_post_summaries" && record.operation === "upsert";
  }) as { rows?: Record<string, unknown>[]; options?: Record<string, unknown> } | undefined;
  assertEquals(upsert?.options?.onConflict, "feed_id,reddit_post_id");
  assertEquals(upsert?.rows?.[0]?.owner_id, "owner-1");
  assertEquals(upsert?.rows?.[0]?.feed_id, "feed-1");
  assertEquals(upsert?.rows?.[0]?.subreddit, "programming");
  assertEquals(upsert?.rows?.[0]?.reddit_post_id, "abc123");
  assertEquals(upsert?.rows?.[0]?.summary, "Tóm tắt tiếng Việt.");
  assertEquals(upsert?.rows?.[0]?.summary_date, "2026-06-05");
  assertEquals(upsert?.rows?.[0]?.ai_provider, "gemini");
});

Deno.test("reddit summary handler skips existing posts", async () => {
  const calls: unknown[] = [];
  const feeds = [{ id: "feed-1", title: "Programming", url: "https://www.reddit.com/r/programming/.rss" }];
  const handler = createRedditSummaryHandler({
    getEnv: (name) => ({
      GEMINI_API_KEY: "gemini-key",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      OWNER_USER_ID: "owner-1",
    })[name] ?? null,
    createClient: (() => createFakeSupabase(calls, feeds, [{ reddit_post_id: "abc123" }, { reddit_post_id: "def456" }])) as never,
    now: () => new Date("2026-06-05T12:00:00.000Z"),
    fetch: (url) => {
      if (String(url) === "https://www.reddit.com/r/programming/.rss") return Promise.resolve(new Response(redditAtom));
      throw new Error("Gemini should not be called for existing posts");
    },
  });

  const response = await handler(new Request("https://example.com/reddit-summary"));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.postsFound, 2);
  assertEquals(body.postsSummarized, 0);
  assertEquals(body.skippedPosts, 2);
});

Deno.test("reddit summary handler continues when one reddit feed fails", async () => {
  const calls: unknown[] = [];
  const feeds = [
    { id: "feed-1", title: "Broken", url: "https://www.reddit.com/r/broken/.rss" },
    { id: "feed-2", title: "Programming", url: "https://www.reddit.com/r/programming/.rss" },
  ];
  const handler = createRedditSummaryHandler({
    getEnv: (name) => ({
      GEMINI_API_KEY: "gemini-key",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      OWNER_USER_ID: "owner-1",
    })[name] ?? null,
    createClient: (() => createFakeSupabase(calls, feeds)) as never,
    now: () => new Date("2026-06-05T12:00:00.000Z"),
    fetch: (url) => {
      if (String(url) === "https://www.reddit.com/r/broken/.rss") {
        return Promise.resolve(new Response("nope", { status: 500 }));
      }
      if (String(url) === "https://www.reddit.com/r/programming/.rss") return Promise.resolve(new Response(redditAtom));
      return Promise.resolve(Response.json({ candidates: [{ content: { parts: [{ text: "Tóm tắt." }] } }] }));
    },
  });

  const response = await handler(new Request("https://example.com/reddit-summary"));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.failedFeedCount, 1);
  assertEquals(body.postsSummarized, 2);
  assertEquals(body.failures[0].feed_id, "feed-1");
});
```

- [ ] **Step 2: Run handler tests and verify failure**

Run:

```bash
deno test supabase/functions/reddit-summary/index.test.ts
```

Expected: FAIL because `createRedditSummaryHandler` is not exported.

- [ ] **Step 3: Append handler implementation**

Append to `supabase/functions/reddit-summary/index.ts`:

```ts
async function existingPostIds(input: {
  supabase: ReturnType<typeof createClient>;
  feedId: string;
  postIds: string[];
}): Promise<Set<string>> {
  if (input.postIds.length === 0) return new Set();

  const { data, error } = await input.supabase
    .from("reddit_post_summaries")
    .select("reddit_post_id")
    .eq("feed_id", input.feedId)
    .in("reddit_post_id", input.postIds);
  if (error) throw new Error(error.message);

  return new Set((data ?? []).map((row: { reddit_post_id: string }) => row.reddit_post_id));
}

export function createRedditSummaryHandler(deps: HandlerDeps) {
  return async (request: Request): Promise<Response> => {
    try {
      const requestUrl = new URL(request.url);
      const limit = parseLimit(requestUrl.searchParams.get("limit"));
      const apiKey = deps.getEnv("GEMINI_API_KEY")?.trim();
      const model = deps.getEnv("GEMINI_MODEL")?.trim() || "gemini-2.0-flash";
      const timeZone = deps.getEnv("APP_TIMEZONE")?.trim() || "Asia/Saigon";

      if (!apiKey) return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500);
      const ownerId = deps.getEnv("OWNER_USER_ID")?.trim();
      if (!ownerId) return jsonResponse({ error: "Missing OWNER_USER_ID" }, 500);

      const supabase = deps.createClient(
        requiredEnv(deps, "SUPABASE_URL"),
        requiredEnv(deps, "SUPABASE_SERVICE_ROLE_KEY"),
      );
      const now = deps.now?.() ?? new Date();

      const { data: feeds, error: feedsError } = await supabase
        .from("feeds")
        .select("id,title,url")
        .eq("owner_id", ownerId)
        .eq("is_active", true);
      if (feedsError) throw new Error(feedsError.message);

      const feedRows = (feeds ?? []) as FeedRow[];
      const redditFeeds = feedRows
        .map((feed) => ({ feed, info: extractRedditFeedInfo(feed.url) }))
        .filter((entry): entry is { feed: FeedRow; info: RedditFeedInfo } => entry.info !== null);

      if (redditFeeds.length === 0) {
        return jsonResponse({
          error: "No active Reddit feeds found",
          scannedFeedCount: feedRows.length,
          redditFeedCount: 0,
          postsFound: 0,
          postsSummarized: 0,
          skippedPosts: 0,
          failedFeedCount: 0,
          failures: [],
        }, 400);
      }

      const failures: FeedFailure[] = [];
      let postsFound = 0;
      let postsSummarized = 0;
      let skippedPosts = 0;

      for (const { feed, info } of redditFeeds) {
        try {
          const feedResponse = await deps.fetch(info.url, {
            headers: {
              "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
              "User-Agent": "Mozilla/5.0 (compatible; RSS News Summary/0.1; +https://example.com)",
            },
          });
          if (!feedResponse.ok) throw new Error(`Reddit RSS request failed with status ${feedResponse.status}`);

          const xml = await feedResponse.text();
          const items = parseFeedItems(xml, limit).map((item) => ({
            ...item,
            feedId: feed.id,
            subreddit: info.subreddit,
          }));
          postsFound += items.length;

          const savedIds = await existingPostIds({
            supabase,
            feedId: feed.id,
            postIds: items.map((item) => item.redditPostId),
          });
          const newItems = items.filter((item) => !savedIds.has(item.redditPostId));
          skippedPosts += items.length - newItems.length;

          const rows = [];
          for (const item of newItems) {
            const summary = await summarizeWithGemini({ apiKey, model, item, fetch: deps.fetch });
            rows.push({
              owner_id: ownerId,
              feed_id: feed.id,
              subreddit: info.subreddit,
              reddit_post_id: item.redditPostId,
              title: item.title,
              url: item.url,
              summary,
              summary_date: summaryDateForItem(item.publishedAt, now, timeZone),
              published_at: item.publishedAt,
              fetched_at: now.toISOString(),
              ai_provider: "gemini",
              ai_model: model,
            });
          }

          if (rows.length > 0) {
            const { error: upsertError } = await supabase
              .from("reddit_post_summaries")
              .upsert(rows, { onConflict: "feed_id,reddit_post_id" });
            if (upsertError) throw new Error(upsertError.message);
          }
          postsSummarized += rows.length;

          const { error: updateError } = await supabase.from("feeds")
            .update({ last_fetched_at: now.toISOString(), last_error: null })
            .eq("id", feed.id);
          if (updateError) throw new Error(updateError.message);
        } catch (error) {
          const message = errorMessage(error);
          failures.push({ feed_id: feed.id, feed_url: feed.url, error: message });
          const { error: updateError } = await supabase.from("feeds")
            .update({ last_error: message })
            .eq("id", feed.id);
          if (updateError) {
            failures.push({ feed_id: feed.id, feed_url: feed.url, error: updateError.message });
          }
        }
      }

      return jsonResponse({
        scannedFeedCount: feedRows.length,
        redditFeedCount: redditFeeds.length,
        postsFound,
        postsSummarized,
        skippedPosts,
        failedFeedCount: new Set(failures.map((failure) => failure.feed_id)).size,
        failures,
      });
    } catch (error) {
      return jsonResponse({ error: errorMessage(error) }, 500);
    }
  };
}

export const handler = createRedditSummaryHandler({
  createClient,
  fetch,
  getEnv: (name) => Deno.env.get(name),
});

if (import.meta.main) {
  Deno.serve(handler);
}
```

- [ ] **Step 4: Run handler tests and verify pass**

Run:

```bash
deno test supabase/functions/reddit-summary/index.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit handler work**

Only run commit if user explicitly requested commits for implementation.

```bash
git add supabase/functions/reddit-summary/index.ts supabase/functions/reddit-summary/index.test.ts
git commit -m "feat: summarize reddit rss posts"
```

## Task 4: Add Frontend API

**Files:**
- Create: `src/api/redditPostsApi.ts`
- Create: `src/api/redditPostsApi.test.ts`

- [ ] **Step 1: Create failing API test**

Create `src/api/redditPostsApi.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRedditPostSummaries } from "./redditPostsApi";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const order3 = vi.fn(() => ({ limit }));
  const order2 = vi.fn(() => ({ order: order3 }));
  const order1 = vi.fn(() => ({ order: order2 }));
  const select = vi.fn(() => ({ order: order1 }));
  const fromTable = vi.fn(() => ({ select }));
  return { fromTable, limit, order1, order2, order3, select };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.fromTable,
  },
}));

describe("listRedditPostSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches newest public Reddit post summaries", async () => {
    mocks.limit.mockResolvedValue({
      data: [{
        id: "post-1",
        summary_date: "2026-06-05",
        subreddit: "programming",
        title: "Reddit title",
        url: "https://www.reddit.com/r/programming/comments/abc123/title/",
        summary: "Tóm tắt tiếng Việt.",
        published_at: "2026-06-05T01:30:00.000Z",
        fetched_at: "2026-06-05T02:00:00.000Z",
      }],
      error: null,
    });

    await expect(listRedditPostSummaries(25)).resolves.toEqual([{
      id: "post-1",
      summary_date: "2026-06-05",
      subreddit: "programming",
      title: "Reddit title",
      url: "https://www.reddit.com/r/programming/comments/abc123/title/",
      summary: "Tóm tắt tiếng Việt.",
      published_at: "2026-06-05T01:30:00.000Z",
      fetched_at: "2026-06-05T02:00:00.000Z",
    }]);

    expect(mocks.fromTable).toHaveBeenCalledWith("public_reddit_post_summaries");
    expect(mocks.select).toHaveBeenCalledWith("id,summary_date,subreddit,title,url,summary,published_at,fetched_at");
    expect(mocks.order1).toHaveBeenCalledWith("summary_date", { ascending: false });
    expect(mocks.order2).toHaveBeenCalledWith("published_at", { ascending: false, nullsFirst: false });
    expect(mocks.order3).toHaveBeenCalledWith("fetched_at", { ascending: false });
    expect(mocks.limit).toHaveBeenCalledWith(25);
  });
});
```

- [ ] **Step 2: Run API test and verify failure**

Run:

```bash
npm run test -- src/api/redditPostsApi.test.ts
```

Expected: FAIL because `src/api/redditPostsApi.ts` does not exist.

- [ ] **Step 3: Implement API module**

Create `src/api/redditPostsApi.ts`:

```ts
import { supabase } from "../lib/supabaseClient";

export type RedditPostSummary = {
  id: string;
  summary_date: string;
  subreddit: string;
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  fetched_at: string;
};

export async function listRedditPostSummaries(limit = 50): Promise<RedditPostSummary[]> {
  const { data, error } = await supabase
    .from("public_reddit_post_summaries")
    .select("id,summary_date,subreddit,title,url,summary,published_at,fetched_at")
    .order("summary_date", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 4: Run API test and verify pass**

Run:

```bash
npm run test -- src/api/redditPostsApi.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API work**

Only run commit if user explicitly requested commits for implementation.

```bash
git add src/api/redditPostsApi.ts src/api/redditPostsApi.test.ts
git commit -m "feat: add reddit summaries api"
```

## Task 5: Add Reddit Frontend Page

**Files:**
- Create: `src/pages/RedditNewsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/DigestsPage.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Update App test mocks and add failing route test**

Modify `src/App.test.tsx`:

Add hoisted mock near `digestsApiMock`:

```ts
const redditPostsApiMock = vi.hoisted(() => ({
  listRedditPostSummaries: vi.fn(),
}));
```

Add mock after `vi.mock("./api/runsApi"...)`:

```ts
vi.mock("./api/redditPostsApi", () => ({
  listRedditPostSummaries: redditPostsApiMock.listRedditPostSummaries,
}));
```

Add reset in `beforeEach`:

```ts
redditPostsApiMock.listRedditPostSummaries.mockReset();
redditPostsApiMock.listRedditPostSummaries.mockResolvedValue([]);
```

Add test in `describe("App", () => { ... })`:

```tsx
  it("renders public Reddit news page", async () => {
    redditPostsApiMock.listRedditPostSummaries.mockResolvedValue([{
      id: "post-1",
      summary_date: "2026-06-05",
      subreddit: "programming",
      title: "First Reddit Post",
      url: "https://www.reddit.com/r/programming/comments/abc123/first_reddit_post/",
      summary: "Tóm tắt tiếng Việt.",
      published_at: "2026-06-05T01:30:00.000Z",
      fetched_at: "2026-06-05T02:00:00.000Z",
    }]);

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/reddit"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Reddit News" })).toBeInTheDocument();
    expect(screen.getByText("r/programming")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First Reddit Post" })).toBeInTheDocument();
    expect(screen.getByText("Tóm tắt tiếng Việt.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Reddit post" })).toHaveAttribute(
      "href",
      "https://www.reddit.com/r/programming/comments/abc123/first_reddit_post/",
    );
  });
```

- [ ] **Step 2: Run App test and verify failure**

Run:

```bash
npm run test -- src/App.test.tsx
```

Expected: FAIL because `/reddit` route/page does not exist.

- [ ] **Step 3: Create Reddit page**

Create `src/pages/RedditNewsPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRedditPostSummaries, type RedditPostSummary } from "../api/redditPostsApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";

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

export function RedditNewsPage() {
  const [posts, setPosts] = useState<RedditPostSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    listRedditPostSummaries()
      .then((nextPosts) => {
        if (active) setPosts(nextPosts);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="reddit-page page-shell">
      <Link className="back-link" to="/digests">Back to Daily Digest</Link>
      <div className="page-kicker">Reddit briefing</div>
      <h1 className="page-title">Reddit News</h1>
      <p className="page-intro">Vietnamese summaries from configured Reddit RSS feeds.</p>

      {loading && <p className="loading-text">Loading Reddit news...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && posts.length === 0 && (
        <EmptyState title="No Reddit posts" body="No Reddit post summaries have been saved yet." />
      )}
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
    </section>
  );
}
```

- [ ] **Step 4: Add route**

Modify `src/App.tsx`:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { AdminPage } from "./pages/AdminPage";
import { DigestDetailPage } from "./pages/DigestDetailPage";
import { DigestsPage } from "./pages/DigestsPage";
import { LoginPage } from "./pages/LoginPage";
import { RedditNewsPage } from "./pages/RedditNewsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/digests" replace />} />
        <Route path="/digests" element={<DigestsPage />} />
        <Route path="/digests/:date" element={<DigestDetailPage />} />
        <Route path="/reddit" element={<RedditNewsPage />} />
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

- [ ] **Step 5: Add digest-to-reddit link**

Modify `src/pages/DigestsPage.tsx` imports:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDigest, type DailyDigest } from "../api/digestsApi";
```

Add link after intro paragraph:

```tsx
      <Link className="back-link" to="/reddit">Read Reddit News</Link>
```

- [ ] **Step 6: Add styles**

Add to `src/styles.css` before media query:

```css
.reddit-list {
  display: grid;
  gap: 14px;
}

.reddit-card {
  background: var(--color-card);
  border: 1px solid var(--color-hairline);
  border-radius: 16px;
  padding: 22px;
}

.reddit-card-meta {
  align-items: center;
  color: var(--color-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 8px;
  margin-bottom: 10px;
}

.reddit-subreddit {
  background: var(--color-warning-bg);
  border-radius: 999px;
  color: var(--color-warning-text);
  font-weight: 700;
  padding: 4px 10px;
}

.reddit-card h2 {
  color: var(--color-ink);
  font-family: "Cormorant Garamond", "EB Garamond", Georgia, serif;
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.12;
  margin: 0 0 12px;
}

.reddit-card p {
  color: var(--color-body);
  line-height: 1.65;
  margin: 0 0 16px;
}

.reddit-card a {
  color: var(--color-primary);
  font-weight: 600;
}
```

- [ ] **Step 7: Run App test and verify pass**

Run:

```bash
npm run test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit frontend page work**

Only run commit if user explicitly requested commits for implementation.

```bash
git add src/pages/RedditNewsPage.tsx src/App.tsx src/pages/DigestsPage.tsx src/styles.css src/App.test.tsx
git commit -m "feat: add public reddit news page"
```

## Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run Reddit Edge Function tests**

Run:

```bash
deno test supabase/functions/reddit-summary/index.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
npm run test -- src/api/redditPostsApi.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff -- supabase/migrations/202606050001_reddit_post_summaries.sql supabase/functions/reddit-summary/index.ts supabase/functions/reddit-summary/index.test.ts src/api/redditPostsApi.ts src/api/redditPostsApi.test.ts src/pages/RedditNewsPage.tsx src/App.tsx src/pages/DigestsPage.tsx src/styles.css src/App.test.tsx
```

Expected: diff only contains Reddit summary feature changes.

- [ ] **Step 6: Final commit**

Only run commit if user explicitly requested commits for implementation and earlier task commits were not made.

```bash
git add supabase/migrations/202606050001_reddit_post_summaries.sql supabase/functions/reddit-summary/index.ts supabase/functions/reddit-summary/index.test.ts src/api/redditPostsApi.ts src/api/redditPostsApi.test.ts src/pages/RedditNewsPage.tsx src/App.tsx src/pages/DigestsPage.tsx src/styles.css src/App.test.tsx docs/superpowers/specs/2026-06-05-reddit-post-summaries-design.md docs/superpowers/plans/2026-06-05-reddit-post-summaries.md
git commit -m "feat: add reddit post summaries"
```

## Self-Review

- Spec coverage: schema, public view, Edge Function, Gemini prompt, `summary_date`, public `/reddit` page, navigation, tests, and verification all mapped to tasks.
- Placeholder scan: no placeholder markers or vague implementation steps remain.
- Type consistency: frontend uses `RedditPostSummary`; Edge Function uses `RedditFeedItem`, `SourceRedditItem`, `redditPostId`, and DB `reddit_post_id` consistently.
