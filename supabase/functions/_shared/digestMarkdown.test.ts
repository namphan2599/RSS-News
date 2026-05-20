import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
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
  assertStringIncludes(
    markdown,
    "**[Story One](https://example.com/story)** - Short summary.",
  );
  assertStringIncludes(markdown, "Run: run-1");
});

Deno.test("renderDigestMarkdown neutralizes markdown and html injection in AI text", () => {
  const markdown = renderDigestMarkdown({
    date: "2026-05-19",
    generatedAt: "2026-05-19 07:00 Asia/Saigon",
    feedCount: 1,
    itemCount: 1,
    provider: "gemini",
    model: "gemini-2.0-flash",
    runId: "run-1",
    digest: {
      title: "ignored",
      executiveSummary:
        "# Pwned\n<script>alert(1)</script> **bold** [x](javascript:alert(1))",
      sections: [
        {
          heading: "## Heading <img src=x onerror=alert(1)>",
          bullets: [
            {
              title: "[Breaking](javascript:alert(1)) <b>Title</b>",
              summary: "- injected\n<img src=x onerror=alert(1)>",
              url: "https://example.com/story",
              source: "**Source** <script>alert(1)</script>",
            },
          ],
        },
      ],
      moreLinks: [
        {
          title: "<i>More</i> [bad](https://evil.example)",
          url: "https://example.com/more",
          source: "# Source",
        },
      ],
    },
  });

  assertStringIncludes(markdown, "Pwned alert 1 bold x");
  assertStringIncludes(markdown, "## Heading");
  assertStringIncludes(
    markdown,
    "**[Breaking Title](https://example.com/story)** - injected",
  );
  assertStringIncludes(markdown, "Source: Source alert 1");
  assertStringIncludes(
    markdown,
    "- [More bad](https://example.com/more) - Source",
  );
});

Deno.test("renderDigestMarkdown replaces unsafe markdown URLs with safe placeholders", () => {
  const markdown = renderDigestMarkdown({
    date: "2026-05-19",
    generatedAt: "2026-05-19 07:00 Asia/Saigon",
    feedCount: 1,
    itemCount: 2,
    provider: "gemini",
    model: "gemini-2.0-flash",
    runId: "run-1",
    digest: {
      title: "ignored",
      executiveSummary: "Summary",
      sections: [
        {
          heading: "Top",
          bullets: [
            {
              title: "JavaScript",
              summary: "Unsafe URL.",
              url: "javascript:alert(1)",
              source: "Example",
            },
            {
              title: "Relative",
              summary: "Relative URL.",
              url: "/story",
              source: "Example",
            },
          ],
        },
      ],
      moreLinks: [
        {
          title: "Mail",
          url: "mailto:test@example.com",
          source: "Example",
        },
      ],
    },
  });

  assertStringIncludes(markdown, "**[JavaScript](#)** - Unsafe URL.");
  assertStringIncludes(markdown, "**[Relative](#)** - Relative URL.");
  assertStringIncludes(markdown, "- [Mail](#) - Example");
  assertEquals(markdown.includes("javascript:"), false);
  assertEquals(markdown.includes("mailto:"), false);
});
