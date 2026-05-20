import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseFeed } from "./rss.ts";

Deno.test("parseFeed extracts feed metadata and normalized items", async () => {
  const feed = await parseFeed(`
    <rss version="2.0">
      <channel>
        <title>Example Feed</title>
        <link>https://example.com/</link>
        <item>
          <title>Story title</title>
          <link>https://example.com/story?utm_source=x&id=42#section</link>
          <description><![CDATA[
            <p>Hello&nbsp;<strong>RSS</strong> &amp; friends.</p>
          ]]></description>
          <pubDate>Tue, 19 May 2026 10:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
  `);

  assertEquals(feed.title, "Example Feed");
  assertEquals(feed.siteUrl, "https://example.com/");
  assertEquals(feed.items.length, 1);
  assertEquals(feed.items[0].title, "Story title");
  assertEquals(feed.items[0].url, "https://example.com/story?id=42");
  assertEquals(feed.items[0].description, "Hello RSS & friends.");
  assertEquals(feed.items[0].contentHash.length, 64);
});
