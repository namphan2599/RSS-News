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
          <guid>story-guid</guid>
          <link>https://example.com/story?utm_source=x&id=42#section</link>
          <description><![CDATA[
            <p>Hello&nbsp;<strong>RSS</strong> &amp; friends with extra words.</p>
          ]]></description>
          <pubDate>Tue, 19 May 2026 10:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Fallback link title</title>
          <description>Fallback description</description>
        </item>
        <item>
          <link>https://example.com/missing-title</link>
          <description>Skipped because title is missing</description>
        </item>
      </channel>
    </rss>
  `, "feed-1", "https://fallback.example.com/feed.xml", 24);

  assertEquals(feed.feedTitle, "Example Feed");
  assertEquals(feed.siteUrl, "https://example.com");
  assertEquals(feed.items.length, 2);
  assertEquals(feed.items[0].feedId, "feed-1");
  assertEquals(feed.items[0].guid, "story-guid");
  assertEquals(feed.items[0].title, "Story title");
  assertEquals(
    feed.items[0].url,
    "https://example.com/story?utm_source=x&id=42#section",
  );
  assertEquals(feed.items[0].normalizedUrl, "https://example.com/story?id=42");
  assertEquals(feed.items[0].description, "Hello RSS & friends...");
  assertEquals(feed.items[0].publishedAt, "2026-05-19T10:00:00.000Z");
  assertEquals(feed.items[0].contentHash.length, 64);
  assertEquals(feed.items[1].url, "https://fallback.example.com/feed.xml");
  assertEquals(
    feed.items[1].normalizedUrl,
    "https://fallback.example.com/feed.xml",
  );
});

Deno.test("parseFeed extracts Atom metadata and entries", async () => {
  const feed = await parseFeed(`
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <link rel="self" href="https://example.com/atom.xml" />
      <link rel="alternate" href="https://example.com/" />
      <entry>
        <title>Atom story</title>
        <id>tag:example.com,2026:story</id>
        <link href="https://example.com/atom-story/?utm_campaign=x#read" />
        <summary><![CDATA[<p>Atom&nbsp;summary with details</p>]]></summary>
        <updated>2026-05-20T03:04:05Z</updated>
      </entry>
    </feed>
  `, "feed-atom", "https://example.com/atom.xml", 200);

  assertEquals(feed.feedTitle, "Atom Feed");
  assertEquals(feed.siteUrl, "https://example.com");
  assertEquals(feed.items.length, 1);
  assertEquals(feed.items[0].feedId, "feed-atom");
  assertEquals(feed.items[0].guid, "tag:example.com,2026:story");
  assertEquals(
    feed.items[0].url,
    "https://example.com/atom-story/?utm_campaign=x#read",
  );
  assertEquals(feed.items[0].normalizedUrl, "https://example.com/atom-story");
  assertEquals(feed.items[0].description, "Atom summary with details");
  assertEquals(feed.items[0].publishedAt, "2026-05-20T03:04:05.000Z");
});
