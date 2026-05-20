import type { DigestInputItem } from "./types.ts";

export function buildDigestPrompt(date: string, items: DigestInputItem[]): string {
  const compactItems = items.map((item) => ({
    id: item.id,
    s: item.feedTitle,
    t: item.title,
    u: item.url,
    d: item.description ?? "",
    p: item.publishedAt ?? "",
  }));

  return [
    "You create concise daily RSS digests.",
    "",
    "Use only the provided RSS title, description, source, date, and URL.",
    "Do not infer facts beyond the provided text.",
    "Group related stories into 3-6 useful sections.",
    "Prefer concise summaries over commentary.",
    "Deduplicate similar stories.",
    "Return valid JSON matching this shape:",
    '{"title":"Daily Digest: YYYY-MM-DD","executiveSummary":"string","sections":[{"heading":"string","bullets":[{"title":"string","summary":"string","url":"string","source":"string"}]}],"moreLinks":[{"title":"string","url":"string","source":"string"}]}',
    "",
    "For each selected item:",
    "- Keep summary under 35 words.",
    "- Preserve the original URL exactly.",
    "- Mention uncertainty if the description is vague.",
    "- Do not invent source names.",
    "",
    `Input date: ${date}`,
    `Items: ${JSON.stringify(compactItems)}`,
  ].join("\n");
}
