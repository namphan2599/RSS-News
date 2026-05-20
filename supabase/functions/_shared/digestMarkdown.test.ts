import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { renderDigestMarkdown } from "./digestMarkdown.ts";

Deno.test("renderDigestMarkdown writes deterministic daily digest", () => {
  const markdown = renderDigestMarkdown({
    date: "2026-05-19",
    generatedAt: "2026-05-19 07:00 Asia/Saigon",
    feedCount: 2,
    itemCount: 1,
    provider: "gemini",
    model: "gemini-2.0-flash",
    runId: "run-1",
    digest: {
      title: "Daily Digest: 2026-05-19",
      executiveSummary: "One important thing happened.",
      sections: [
        {
          heading: "Top Stories",
          bullets: [
            {
              title: "Story [One]",
              summary: "Short summary.",
              url: "https://example.com/story",
              source: "Example",
            },
          ],
        },
      ],
      moreLinks: [],
    },
  });

  assertStringIncludes(markdown, "# Daily Digest: 2026-05-19");
  assertStringIncludes(markdown, "Sources: 2 feeds, 1 items");
  assertStringIncludes(markdown, "**[Story \\[One\\]](https://example.com/story)** - Short summary.");
  assertStringIncludes(markdown, "Run: run-1");
});
