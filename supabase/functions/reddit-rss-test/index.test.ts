import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createRedditRssTestHandler } from "./index.ts";

Deno.test("reddit RSS test handler fetches default Reddit RSS URL with diagnostic headers", async () => {
  const requested: { url?: string; init?: RequestInit } = {};
  const handler = createRedditRssTestHandler({
    fetch: (url, init) => {
      requested.url = String(url);
      requested.init = init;
      return Promise.resolve(new Response("<feed>reddit</feed>", {
        headers: { "Content-Type": "application/atom+xml; charset=UTF-8" },
        status: 200,
      }));
    },
  });

  const response = await handler(new Request("https://example.com/reddit-rss-test"));

  assertEquals(response.status, 200);
  assertEquals(requested.url, "https://www.reddit.com/r/programming/.rss");
  assertEquals((requested.init?.headers as Record<string, string>)["Accept"].includes("application/atom+xml"), true);
  assertEquals((requested.init?.headers as Record<string, string>)["User-Agent"].includes("Mozilla/5.0"), true);
  assertEquals(await response.json(), {
    ok: true,
    status: 200,
    contentType: "application/atom+xml; charset=UTF-8",
    url: "https://www.reddit.com/r/programming/.rss",
    bodyPreview: "<feed>reddit</feed>",
  });
});

Deno.test("reddit RSS test handler rejects non-http URLs", async () => {
  const handler = createRedditRssTestHandler({
    fetch: () => Promise.resolve(new Response("unused")),
  });

  const response = await handler(new Request("https://example.com/reddit-rss-test?url=file:///tmp/rss.xml"));

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "url must use http or https" });
});
