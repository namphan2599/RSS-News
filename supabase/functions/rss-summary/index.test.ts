import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createRssSummaryHandler,
  parseFeedItems,
  validateFeedUrl,
} from "./index.ts";

function createFakeSupabase(calls: unknown[], feeds: unknown[]) {
  return {
    from: (table: string) => {
      if (table === "feeds") {
        return {
          select: (columns: string) => ({
            eq: (column: string, value: unknown) => ({
              eq: (secondColumn: string, secondValue: unknown) => {
                calls.push({
                  table,
                  operation: "select",
                  columns,
                  filters: [[column, value], [secondColumn, secondValue]],
                });
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

      if (table === "digest_runs") {
        return {
          insert: (row: unknown) => ({
            select: () => ({
              single: () => {
                calls.push({ table, operation: "insert", row });
                return Promise.resolve({ data: { id: "run-1" }, error: null });
              },
            }),
          }),
          select: () => {
            throw new Error("unsupported digest_runs select");
          },
          update: () => {
            throw new Error("unsupported digest_runs update");
          },
          upsert: () => {
            throw new Error("unsupported digest_runs upsert");
          },
        };
      }

      if (table === "daily_digests") {
        return {
          upsert: (row: unknown, options: unknown) => ({
            select: () => ({
              single: () => {
                calls.push({ table, operation: "upsert", row, options });
                return Promise.resolve({ data: { id: "digest-1" }, error: null });
              },
            }),
          }),
          insert: () => {
            throw new Error("unsupported daily_digests insert");
          },
          select: () => {
            throw new Error("unsupported daily_digests select");
          },
          update: () => {
            throw new Error("unsupported daily_digests update");
          },
        };
      }

      throw new Error(`unsupported table ${table}`);
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
  assertThrows(
    () => validateFeedUrl("file:///tmp/rss.xml"),
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
      if (String(url) === "https://example.com/rss.xml") {
        assertEquals((init?.headers as Record<string, string>)["Accept"].includes("application/atom+xml"), true);
        assertEquals((init?.headers as Record<string, string>)["User-Agent"].includes("Mozilla/5.0"), true);
        return Promise.resolve(new Response(rssFeed));
      }
      if (String(url) === "https://games.example.com/rss.xml") {
        return Promise.resolve(new Response(atomFeed));
      }

      assertEquals(String(url).includes("generativelanguage.googleapis.com"), true);
      assertEquals(init?.method, "POST");
      const body = String(init?.body);
      assertEquals(body.includes("Programming"), true);
      assertEquals(body.includes("Dev Feed"), true);
      assertEquals(body.includes("Game Feed"), true);
      assertEquals(body.includes("First Atom item"), true);
      assertEquals(body.includes("[First Atom item](https://example.com/atom-first)"), true);
      assertEquals(body.includes("category"), true);
      assertEquals(body.includes("infer"), true);
      assertEquals(body.includes("include exactly one bullet under its topic heading"), true);
      assertEquals(body.includes("- {markdownLink}: {one concise Vietnamese summary sentence}"), true);
      assertEquals(body.includes("same bullet structure for every post"), true);
      return Promise.resolve(Response.json({
        candidates: [{
          content: { parts: [{ text: "Programming\n- Dev updates.\n\nGames\n- Game updates." }] },
        }],
      }));
    },
  });

  const response = await handler(
    new Request("https://example.com/rss-summary"),
  );

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
  const selectCall = calls.find((call) => {
    const record = call as { table?: unknown; operation?: unknown };
    return record.table === "feeds" && record.operation === "select";
  }) as { filters?: unknown } | undefined;
  assertEquals(selectCall?.filters, [["owner_id", "owner-1"], ["is_active", true]]);
  assertEquals(calls.some((call) => JSON.stringify(call).includes("upload")), false);
});

Deno.test("rss summary handler saves digest date in configured local timezone", async () => {
  const calls: unknown[] = [];
  const feeds = [
    { id: "feed-1", title: "Dev Feed", url: "https://example.com/rss.xml", category: "Programming" },
  ];
  const handler = createRssSummaryHandler({
    getEnv: (name) => ({
      APP_TIMEZONE: "Asia/Saigon",
      GEMINI_API_KEY: "gemini-key",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      OWNER_USER_ID: "owner-1",
    })[name] ?? null,
    createClient: (() => createFakeSupabase(calls, feeds)) as never,
    now: () => new Date("2026-05-29T22:00:00.000Z"),
    fetch: (url) => {
      if (String(url) === "https://example.com/rss.xml") {
        return Promise.resolve(new Response(rssFeed));
      }

      return Promise.resolve(Response.json({
        candidates: [{ content: { parts: [{ text: "Programming\n- Dev updates." }] } }],
      }));
    },
  });

  const response = await handler(new Request("https://example.com/rss-summary"));

  assertEquals(response.status, 200);
  const digestUpsert = calls.find((call) => {
    const record = call as { table?: unknown; operation?: unknown };
    return record.table === "daily_digests" && record.operation === "upsert";
  }) as { row?: Record<string, unknown> } | undefined;
  assertEquals(digestUpsert?.row?.digest_date, "2026-05-30");
  assertEquals(digestUpsert?.row?.title, "Daily RSS Digest: 2026-05-30");

  const runInsert = calls.find((call) => {
    const record = call as { table?: unknown; operation?: unknown };
    return record.table === "digest_runs" && record.operation === "insert";
  }) as { row?: Record<string, unknown> } | undefined;
  assertEquals(runInsert?.row?.run_date, "2026-05-30");
});

Deno.test("rss summary handler ignores Gemini thought parts", async () => {
  const calls: unknown[] = [];
  const feeds = [
    { id: "feed-1", title: "Dev Feed", url: "https://example.com/rss.xml", category: "Programming" },
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
    fetch: (url) => {
      if (String(url) === "https://example.com/rss.xml") {
        return Promise.resolve(new Response(rssFeed));
      }

      return Promise.resolve(Response.json({
        candidates: [{
          content: {
            parts: [
              { thought: true, text: "I need to inspect these URLs first." },
              { text: "Programming\n- [First RSS item](https://example.com/first) update." },
            ],
          },
        }],
      }));
    },
  });

  const response = await handler(new Request("https://example.com/rss-summary"));

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.summary, "Programming\n- [First RSS item](https://example.com/first) update.");
});

Deno.test("rss summary handler saves partial digest when one feed fails", async () => {
  const calls: unknown[] = [];
  const feeds = [
    { id: "feed-1", title: "Broken Feed", url: "https://bad.example.com/rss.xml", category: "Programming" },
    { id: "feed-2", title: "Dev Feed", url: "https://example.com/rss.xml", category: "Programming" },
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
      if (String(url) === "https://bad.example.com/rss.xml") {
        return Promise.resolve(new Response("server error", { status: 500 }));
      }
      if (String(url) === "https://example.com/rss.xml") {
        return Promise.resolve(new Response(rssFeed));
      }

      assertEquals(String(url).includes("generativelanguage.googleapis.com"), true);
      assertEquals(init?.method, "POST");
      const body = String(init?.body);
      assertEquals(body.includes("Programming"), true);
      assertEquals(body.includes("First RSS item"), true);
      assertEquals(body.includes("[First RSS item](https://example.com/first)"), true);
      assertEquals(body.includes("First & useful summary"), true);
      return Promise.resolve(Response.json({
        candidates: [{ content: { parts: [{ text: "Programming\n- Dev updates." }] } }],
      }));
    },
  });

  const response = await handler(new Request("https://example.com/rss-summary"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    digestId: "digest-1",
    runId: "run-1",
    status: "partial",
    feedCount: 2,
    failedFeedCount: 1,
    itemCount: 2,
    summary: "Programming\n- Dev updates.",
  });

  assertEquals(calls.some((call) => JSON.stringify(call).includes("upload")), false);
  const digestUpsert = calls.find((call) => {
    const record = call as { table?: unknown; operation?: unknown };
    return record.table === "daily_digests" && record.operation === "upsert";
  }) as { row?: Record<string, unknown>; options?: Record<string, unknown> } | undefined;
  assertEquals(digestUpsert?.row?.storage_bucket, null);
  assertEquals(digestUpsert?.row?.storage_path, null);
  assertEquals(digestUpsert?.row?.title, "Daily RSS Digest: 2026-05-29");
  assertEquals(digestUpsert?.row?.summary, "Programming\n- Dev updates.");
  assertEquals(digestUpsert?.row?.item_count, 2);
  assertEquals(digestUpsert?.options?.onConflict, "owner_id,digest_date");

  const failedFeedUpdate = calls.find((call) => {
    const record = call as { table?: unknown; operation?: unknown; filter?: unknown };
    return record.table === "feeds" && record.operation === "update" &&
      JSON.stringify(record.filter) === JSON.stringify(["id", "feed-1"]);
  }) as { row?: Record<string, unknown> } | undefined;
  assertEquals(failedFeedUpdate?.row?.last_error, "RSS request failed with status 500");

  const successfulFeedUpdate = calls.find((call) => {
    const record = call as { table?: unknown; operation?: unknown; filter?: unknown };
    return record.table === "feeds" && record.operation === "update" &&
      JSON.stringify(record.filter) === JSON.stringify(["id", "feed-2"]);
  }) as { row?: Record<string, unknown> } | undefined;
  assertEquals(successfulFeedUpdate?.row?.last_fetched_at, "2026-05-29T12:00:00.000Z");
  assertEquals(successfulFeedUpdate?.row?.last_error, null);
});
