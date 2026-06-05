import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildPrompt,
  createRedditSummaryHandler,
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
  assertEquals(extractRedditFeedInfo("https://www.reddit.com/r/programming"), null);
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
