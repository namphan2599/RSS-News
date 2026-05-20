import type { DigestSummary } from "./ai/types.ts";

function plainText(text: string): string {
  return text
    .replace(/\[([^\]\n]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>\n]*>/g, " ")
    .replace(/[\\`*_#[\](){}!|>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeMarkdownUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // Fall through to safe placeholder.
  }
  return "#";
}

export function renderDigestMarkdown(input: {
  date: string;
  generatedAt: string;
  feedCount: number;
  itemCount: number;
  provider: string;
  model: string;
  runId: string;
  digest: DigestSummary;
}): string {
  const lines: string[] = [
    `# Daily Digest: ${input.date}`,
    "",
    `Generated: ${input.generatedAt}`,
    `Sources: ${input.feedCount} feeds, ${input.itemCount} items`,
    `Provider: ${input.provider} / ${input.model}`,
    "",
    "## Executive Summary",
    "",
    plainText(input.digest.executiveSummary),
    "",
  ];

  for (const section of input.digest.sections) {
    lines.push(`## ${plainText(section.heading)}`, "");
    for (const bullet of section.bullets) {
      lines.push(
        `- **[${plainText(bullet.title)}](${safeMarkdownUrl(bullet.url)})** - ${
          plainText(bullet.summary)
        }`,
      );
      lines.push(`  Source: ${plainText(bullet.source)}`);
    }
    lines.push("");
  }

  if (input.digest.moreLinks?.length) {
    lines.push("## More Links", "");
    for (const link of input.digest.moreLinks) {
      lines.push(
        `- [${plainText(link.title)}](${safeMarkdownUrl(link.url)}) - ${
          plainText(link.source)
        }`,
      );
    }
    lines.push("");
  }

  lines.push("---", "", `Run: ${input.runId}`, "");
  return lines.join("\n");
}
