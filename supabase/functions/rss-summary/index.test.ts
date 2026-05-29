import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createRssSummaryHandler,
  parseFeedItems,
  validateFeedUrl,
} from "./index.ts";

function createFakeSupabase(calls: unknown[]) {
  return {
    from: (table: string) => ({
      insert: (row: unknown) => {
        calls.push({ table, operation: "insert", row });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: "run-1" }, error: null }),
          }),
        };
      },
      upsert: (row: unknown, options: unknown) => {
        calls.push({ table, operation: "upsert", row, options });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: "digest-1" }, error: null }),
          }),
        };
      },
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, body: string, options: unknown) => {
          calls.push({ bucket, operation: "upload", path, body, options });
          return Promise.resolve({ error: null });
        },
      }),
    },
  };
}

const rssFeed = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>First RSS item</title>
      <link>https://example.com/first</link>
      <description>First &amp; useful summary</description>
    </item>
    <item>
      <title>Second RSS item</title>
      <link>https://example.com/second</link>
      <description><![CDATA[<p>Second summary</p>]]></description>
    </item>
  </channel>
</rss>`;

const atomFeed = `<?xml version="1.0"?>
<feed>
  <entry>
    <title>First Atom item</title>
    <link href="https://example.com/atom-first" />
    <content type="html">Atom &amp; summary</content>
  </entry>
</feed>`;

Deno.test("validateFeedUrl accepts http and https feed URLs", () => {
  assertEquals(validateFeedUrl("https://example.com/rss.xml"), "https://example.com/rss.xml");
  assertEquals(validateFeedUrl("http://example.com/rss.xml"), "http://example.com/rss.xml");
});

Deno.test("validateFeedUrl rejects unsafe feed URLs", () => {
  assertRejects(
    () => Promise.resolve(validateFeedUrl("file:///tmp/rss.xml")),
    Error,
    "url must use http or https",
  );
});

Deno.test("parseFeedItems extracts capped RSS items", () => {
  assertEquals(parseFeedItems(rssFeed, 1), [
    {
      title: "First RSS item",
      url: "https://example.com/first",
      content: "First & useful summary",
    },
  ]);
});

Deno.test("parseFeedItems extracts Atom entries", () => {
  assertEquals(parseFeedItems(atomFeed, 10), [
    {
      title: "First Atom item",
      url: "https://example.com/atom-first",
      content: "Atom & summary",
    },
  ]);
});

Deno.test("rss summary handler returns Gemini summary", async () => {
  const calls: unknown[] = [];
  const handler = createRssSummaryHandler({
    getEnv: (name) => ({
      GEMINI_API_KEY: "gemini-key",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      OWNER_USER_ID: "owner-1",
    })[name] ?? null,
    createClient: (() => createFakeSupabase(calls)) as never,
    now: () => new Date("2026-05-29T12:00:00.000Z"),
    fetch: (url, init) => {
      if (String(url) === "https://example.com/rss.xml") {
        return Promise.resolve(new Response(rssFeed));
      }

      assertEquals(String(url).includes("generativelanguage.googleapis.com"), true);
      assertEquals(init?.method, "POST");
      return Promise.resolve(Response.json({
        candidates: [{
          content: { parts: [{ text: "Short feed summary." }] },
        }],
      }));
    },
  });

  const response = await handler(
    new Request("https://example.com/rss-summary?url=https%3A%2F%2Fexample.com%2Frss.xml&limit=2"),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    feedUrl: "https://example.com/rss.xml",
    digestId: "digest-1",
    items: [
      {
        title: "First RSS item",
        url: "https://example.com/first",
        content: "First & useful summary",
      },
      {
        title: "Second RSS item",
        url: "https://example.com/second",
        content: "Second summary",
      },
    ],
    runId: "run-1",
    summary: "Short feed summary.",
    storagePath: "daily/2026/05/2026-05-29.md",
  });
  assertEquals(calls, [
    {
      table: "digest_runs",
      operation: "insert",
      row: {
        owner_id: "owner-1",
        run_date: "2026-05-29",
        status: "succeeded",
        finished_at: "2026-05-29T12:00:00.000Z",
        feed_count: 1,
        item_count: 2,
        selected_item_count: 2,
        ai_provider: "gemini",
        ai_model: "gemini-2.0-flash",
        metadata: { feed_url: "https://example.com/rss.xml" },
      },
    },
    {
      bucket: "digests",
      operation: "upload",
      path: "daily/2026/05/2026-05-29.md",
      body: "# RSS Summary: example.com\n\nShort feed summary.\n\n## Items\n\n- [First RSS item](https://example.com/first) - First & useful summary\n- [Second RSS item](https://example.com/second) - Second summary\n",
      options: { contentType: "text/markdown", upsert: true },
    },
    {
      table: "daily_digests",
      operation: "upsert",
      row: {
        owner_id: "owner-1",
        digest_date: "2026-05-29",
        storage_bucket: "digests",
        storage_path: "daily/2026/05/2026-05-29.md",
        title: "RSS Summary: example.com",
        summary: "Short feed summary.",
        item_count: 2,
        run_id: "run-1",
      },
      options: { onConflict: "owner_id,digest_date" },
    },
  ]);
});

Deno.test("rss summary handler requires url parameter", async () => {
  const handler = createRssSummaryHandler({
    getEnv: () => "gemini-key",
    createClient: (() => {
      throw new Error("client should not be created without url");
    }) as never,
    fetch: (() => {
      throw new Error("fetch should not run without url");
    }) as typeof fetch,
  });

  const response = await handler(new Request("https://example.com/rss-summary"));

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "Missing url query parameter" });
});
