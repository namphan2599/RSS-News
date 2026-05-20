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
    "3eec94911fb33356ff5002271513d584c7db630e83b8dbe6f8b2522da716c115",
  );
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
    "e0493ec42c10a80d11fcf9fa32cd8be502c17e71e97b51137fcec92fa491bdbb",
  );
});
