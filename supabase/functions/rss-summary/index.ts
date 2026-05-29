import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type FeedItem = {
  title: string;
  url: string;
  content: string;
};

type HandlerDeps = {
  createClient: typeof createClient;
  fetch: typeof fetch;
  getEnv: (name: string) => string | undefined | null;
  now?: () => Date;
};

const defaultLimit = 10;
const maxLimit = 25;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value: string, pattern: RegExp): string {
  return decodeEntities(pattern.exec(value)?.[1]?.trim() ?? "");
}

export function validateFeedUrl(feedUrl: string): string {
  const parsed = new URL(feedUrl.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https");
  }
  return parsed.toString();
}

function parseLimit(value: string | null): number {
  if (!value) return defaultLimit;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return defaultLimit;

  return Math.min(parsed, maxLimit);
}

function requiredEnv(deps: HandlerDeps, name: string): string {
  const value = deps.getEnv(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function digestStoragePath(date: string): string {
  const [year, month] = date.split("-");
  return `daily/${year}/${month}/${date}.md`;
}

function digestTitle(feedUrl: string): string {
  return `RSS Summary: ${new URL(feedUrl).hostname}`;
}

function renderMarkdown(input: {
  title: string;
  summary: string;
  items: FeedItem[];
}): string {
  const lines = [
    `# ${input.title}`,
    "",
    input.summary,
    "",
    "## Items",
    "",
  ];

  for (const item of input.items) {
    lines.push(`- [${item.title}](${item.url}) - ${item.content}`);
  }

  lines.push("");
  return lines.join("\n");
}

function parseRssItem(item: string): FeedItem {
  return {
    title: stripTags(firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    url: firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/i),
    content: stripTags(firstMatch(
      item,
      /<(?:description|content:encoded|summary)[^>]*>([\s\S]*?)<\/(?:description|content:encoded|summary)>/i,
    )),
  };
}

function parseAtomEntry(entry: string): FeedItem {
  return {
    title: stripTags(firstMatch(entry, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    url: firstMatch(entry, /<link[^>]+href="([^"]+)"/i),
    content: stripTags(firstMatch(
      entry,
      /<(?:content|summary)[^>]*>([\s\S]*?)<\/(?:content|summary)>/i,
    )),
  };
}

export function parseFeedItems(xml: string, limit: number): FeedItem[] {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items = rssItems.length > 0
    ? rssItems.map(parseRssItem)
    : atomEntries.map(parseAtomEntry);

  return items
    .filter((item) => item.title && item.url)
    .slice(0, limit);
}

function buildPrompt(feedUrl: string, items: FeedItem[]): string {
  return [
    "Summarize these RSS feed items.",
    `Feed URL: ${feedUrl}`,
    "Focus on the main themes and notable items.",
    "Keep it concise and factual.",
    "",
    JSON.stringify(items),
  ].join("\n");
}

async function summarizeWithGemini(input: {
  apiKey: string;
  model: string;
  feedUrl: string;
  items: FeedItem[];
  fetch: typeof fetch;
}): Promise<string> {
  const response = await input.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`,
    {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: buildPrompt(input.feedUrl, input.items) }],
        }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini response did not include summary text");
  }

  return text.trim();
}

async function saveDigest(input: {
  deps: HandlerDeps;
  feedUrl: string;
  items: FeedItem[];
  model: string;
  ownerId: string;
  summary: string;
}): Promise<{ digestId: string; runId: string; storagePath: string }> {
  const now = input.deps.now?.() ?? new Date();
  const digestDate = formatDate(now);
  const title = digestTitle(input.feedUrl);
  const storagePath = digestStoragePath(digestDate);
  const supabase = input.deps.createClient(
    requiredEnv(input.deps, "SUPABASE_URL"),
    requiredEnv(input.deps, "SUPABASE_SERVICE_ROLE_KEY"),
  );

  const { data: run, error: runError } = await supabase.from("digest_runs")
    .insert({
      owner_id: input.ownerId,
      run_date: digestDate,
      status: "succeeded",
      finished_at: now.toISOString(),
      feed_count: 1,
      item_count: input.items.length,
      selected_item_count: input.items.length,
      ai_provider: "gemini",
      ai_model: input.model,
      metadata: { feed_url: input.feedUrl },
    })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const markdown = renderMarkdown({ title, summary: input.summary, items: input.items });
  const { error: uploadError } = await supabase.storage
    .from("digests")
    .upload(storagePath, markdown, {
      contentType: "text/markdown",
      upsert: true,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: digest, error: digestError } = await supabase.from("daily_digests")
    .upsert({
      owner_id: input.ownerId,
      digest_date: digestDate,
      storage_bucket: "digests",
      storage_path: storagePath,
      title,
      summary: input.summary,
      item_count: input.items.length,
      run_id: run.id,
    }, { onConflict: "owner_id,digest_date" })
    .select("id")
    .single();
  if (digestError) throw new Error(digestError.message);

  return { digestId: digest.id, runId: run.id, storagePath };
}

export function createRssSummaryHandler(deps: HandlerDeps) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const rawFeedUrl = url.searchParams.get("url");
      if (!rawFeedUrl) {
        return jsonResponse({ error: "Missing url query parameter" }, 400);
      }

      const feedUrl = validateFeedUrl(rawFeedUrl);
      const limit = parseLimit(url.searchParams.get("limit"));
      const apiKey = deps.getEnv("GEMINI_API_KEY");
      const model = deps.getEnv("GEMINI_MODEL") ?? "gemini-2.0-flash";

      if (!apiKey) {
        return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500);
      }
      const ownerId = deps.getEnv("OWNER_USER_ID")?.trim();
      if (!ownerId) {
        return jsonResponse({ error: "Missing OWNER_USER_ID" }, 500);
      }

      const feedResponse = await deps.fetch(feedUrl, {
        headers: { "User-Agent": "RSS News Summary/0.1" },
      });
      if (!feedResponse.ok) {
        return jsonResponse({
          error: `RSS request failed with status ${feedResponse.status}`,
        }, 502);
      }

      const items = parseFeedItems(await feedResponse.text(), limit);
      if (items.length === 0) {
        return jsonResponse({ error: "No RSS items found" }, 502);
      }

      const summary = await summarizeWithGemini({
        apiKey,
        model,
        feedUrl,
        items,
        fetch: deps.fetch,
      });
      const saved = await saveDigest({
        deps,
        feedUrl,
        items,
        model,
        ownerId,
        summary,
      });

      return jsonResponse({ feedUrl, ...saved, items, summary });
    } catch (error) {
      return jsonResponse({ error: String(error) }, 400);
    }
  };
}

export const handler = createRssSummaryHandler({
  createClient,
  fetch,
  getEnv: (name) => Deno.env.get(name),
});

if (import.meta.main) {
  Deno.serve(handler);
}
