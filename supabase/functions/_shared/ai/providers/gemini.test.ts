import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createGeminiProvider, parseGeminiDigestJson } from "./gemini.ts";

Deno.test("parseGeminiDigestJson validates nested digest shape", () => {
  const digest = parseGeminiDigestJson(JSON.stringify({
    title: " Daily Digest ",
    executiveSummary: " Summary ",
    sections: [
      {
        heading: " Top ",
        bullets: [
          {
            title: " Story ",
            summary: " Short ",
            url: "https://example.com/story",
            source: " Example ",
          },
        ],
      },
    ],
    moreLinks: [
      {
        title: " More ",
        url: "https://example.com/more",
        source: " Example ",
      },
    ],
  }));

  assertEquals(digest.title, "Daily Digest");
  assertEquals(digest.executiveSummary, "Summary");
  assertEquals(digest.sections[0].heading, "Top");
  assertEquals(digest.sections[0].bullets[0].title, "Story");
  assertEquals(digest.moreLinks?.[0].source, "Example");
});

Deno.test("parseGeminiDigestJson rejects malformed nested bullets", () => {
  assertThrows(
    () =>
      parseGeminiDigestJson(JSON.stringify({
        title: "Daily Digest",
        executiveSummary: "Summary",
        sections: [
          {
            heading: "Top",
            bullets: [{
              title: "Story",
              summary: "Short",
              url: 42,
              source: "Example",
            }],
          },
        ],
      })),
    Error,
    "Gemini response field sections[0].bullets[0].url must be a string",
  );
});

Deno.test("parseGeminiDigestJson rejects malformed moreLinks", () => {
  assertThrows(
    () =>
      parseGeminiDigestJson(JSON.stringify({
        title: "Daily Digest",
        executiveSummary: "Summary",
        sections: [{ heading: "Top", bullets: [] }],
        moreLinks: [{ title: "More", url: "https://example.com" }],
      })),
    Error,
    "Gemini response field moreLinks[0].source must be a string",
  );
});

Deno.test("createGeminiProvider rejects malformed parseable response before returning digest", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "Daily Digest",
                      executiveSummary: "Summary",
                      sections: [{ heading: "Top", bullets: "not an array" }],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )) as typeof fetch;

  try {
    const provider = createGeminiProvider("key", "model");
    await assertRejects(
      () =>
        provider.summarizeDailyDigest({
          date: "2026-05-19",
          items: [],
          maxItems: 1,
          maxOutputTokens: 100,
        }),
      Error,
      "Gemini response field sections[0].bullets must be an array",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
