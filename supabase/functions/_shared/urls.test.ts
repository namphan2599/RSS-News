import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildContentHash, normalizeUrl } from "./urls.ts";

Deno.test("normalizeUrl removes tracking params and hash while preserving content params", () => {
  assertEquals(
    normalizeUrl("https://example.com/story?utm_source=x&id=42#section"),
    "https://example.com/story?id=42",
  );
});

Deno.test("buildContentHash returns a stable SHA-256 hex digest", async () => {
  const firstHash = await buildContentHash("same content");
  const secondHash = await buildContentHash("same content");

  assertEquals(firstHash, secondHash);
  assertEquals(firstHash.length, 64);
});
