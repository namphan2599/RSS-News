import type { DigestSummary } from "./ai/types.ts";

function escapeMarkdown(text: string): string {
  return text.replace(/([\\[\]])/g, "\\$1").trim();
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
    input.digest.executiveSummary.trim(),
    "",
  ];

  for (const section of input.digest.sections) {
    lines.push(`## ${escapeMarkdown(section.heading)}`, "");
    for (const bullet of section.bullets) {
      lines.push(`- **[${escapeMarkdown(bullet.title)}](${bullet.url})** - ${bullet.summary.trim()}`);
      lines.push(`  Source: ${escapeMarkdown(bullet.source)}`);
    }
    lines.push("");
  }

  if (input.digest.moreLinks?.length) {
    lines.push("## More Links", "");
    for (const link of input.digest.moreLinks) {
      lines.push(`- [${escapeMarkdown(link.title)}](${link.url}) - ${escapeMarkdown(link.source)}`);
    }
    lines.push("");
  }

  lines.push("---", "", `Run: ${input.runId}`, "");
  return lines.join("\n");
}
