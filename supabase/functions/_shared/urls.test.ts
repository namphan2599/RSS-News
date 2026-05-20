import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildContentHash, normalizeUrl } from "./urls.ts";

Deno.test("normalizeUrl removes tracking params and hash while preserving content params", () => {
  assertEquals(
    normalizeUrl("https://example.com/story?utm_source=x&id=42#section"),
    "https://example.com/story?id=42",
  );
});

Deno.test("normalizeUrl removes planned trailing slashes", () => {
  assertEquals(
    normalizeUrl("https://example.com/story/?id=42&utm_source=x"),
    "https://example.com/story?id=42",
  );
});

Deno.test("buildContentHash hashes planned item identity fields", async () => {
  const item = {
    feedId: "feed-1",
    guid: " guid-123 ",
    publishedAt: "2026-05-19T10:00:00.000Z",
    title: "  Story   Title  ",
    url: "https://example.com/story?utm_source=x&id=42#section",
  };
  const firstHash = await buildContentHash(item);
  const secondHash = await buildContentHash({ ...item });

  assertEquals(firstHash, secondHash);
  assertEquals(firstHash.length, 64);
  assertEquals(
    firstHash,
    "81c89c87e5613726dbb802cdec8f048dee11dee3e79e72ba1f424c3489117bc8",
  );
});

Deno.test("buildContentHash normalizes title case", async () => {
  const firstHash = await buildContentHash({
    feedId: "feed-1",
    guid: "guid-1",
    title: "A Story",
    url: "https://example.com/story",
  });
  const secondHash = await buildContentHash({
    feedId: "feed-1",
    guid: "guid-1",
    title: "a story",
    url: "https://example.com/story",
  });

  assertEquals(firstHash, secondHash);
});

Deno.test("buildContentHash falls back to normalized URL when guid is blank", async () => {
  const hash = await buildContentHash({
    feedId: "feed-1",
    guid: " ",
    title: "Story Title",
    url: "https://example.com/story?utm_source=x&id=42#section",
  });

  assertEquals(
    hash,
    "314e2af2ed5468a12b9fa68464f28578f2f988e3d5a1e3c52b45ea02f89ef6b9",
  );
});
