import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type FeedItem = {
  title: string;
  url: string;
  content: string;
};

type FeedRow = {
  id: string;
  title: string | null;
  url: string;
  category: string | null;
};

type SourceFeedItem = FeedItem & {
  feedId: string;
  feedTitle: string | null;
  feedUrl: string;
  category: string | null;
};

type FeedFailure = {
  feed_id: string;
  feed_url: string;
  error: string;
};

type HandlerDeps = {
  createClient: typeof createClient;
  fetch: typeof fetch;
  getEnv: (name: string) => string | undefined | null;
  now?: () => Date;
};

class SaveDigestError extends Error {
  constructor(message: string, readonly runId: string) {
    super(message);
    this.name = "SaveDigestError";
  }
}

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

function formatDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not format digest date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function digestTitle(date: string): string {
  return `Daily RSS Digest: ${date}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failedFeedCount(failures: FeedFailure[]): number {
  return new Set(failures.map((failure) => failure.feed_id)).size;
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

function buildPrompt(items: SourceFeedItem[]): string {
  const promptItems = items.map((item) => ({
    ...item,
    markdownLink: `[${item.title}](${item.url})`,
  }));

  return [
    "Create one daily RSS digest from the items below.",
    "For each item, visit and read the article at its url before summarizing it; do not rely only on the RSS title or snippet when the full article is accessible.",
    "Start the digest with one short paragraph summarizing today's most notable stories and cross-topic highlights.",
    "After the opening paragraph, group the digest by topic/category.",
    "Use the provided category when present.",
    "When category is null or empty, infer a concise topic from the feed title, RSS content, and article content.",
    "Use clear topic headings like Tech, Programming, Games, Food.",
    "For every news item you mention, include its markdown link using the provided markdownLink value.",
    "Do not mention a news item without a link.",
    "If an article url cannot be accessed, use the RSS title/content as fallback and keep that summary conservative.",
    "Keep the digest concise, factual, and written in Vietnamese.",
    "",
    JSON.stringify(promptItems),
  ].join("\n");
}

async function summarizeWithGemini(input: {
  apiKey: string;
  model: string;
  items: SourceFeedItem[];
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
          parts: [{ text: buildPrompt(input.items) }],
        }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.find((part) => part?.thought !== true && typeof part?.text === "string" && part.text.trim())?.text
    : undefined;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini response did not include summary text");
  }

  return text.trim();
}

async function saveDigest(input: {
  supabase: ReturnType<typeof createClient>;
  digestDate: string;
  feedCount: number;
  failures: FeedFailure[];
  items: SourceFeedItem[];
  model: string;
  now: Date;
  ownerId: string;
  summary: string;
}): Promise<{ digestId: string; runId: string; status: "succeeded" | "partial" }> {
  const title = digestTitle(input.digestDate);
  const failedCount = failedFeedCount(input.failures);
  const status = failedCount > 0 ? "partial" : "succeeded";

  const { data: run, error: runError } = await input.supabase.from("digest_runs")
    .insert({
      owner_id: input.ownerId,
      run_date: input.digestDate,
      status,
      finished_at: input.now.toISOString(),
      feed_count: input.feedCount,
      failed_feed_count: failedCount,
      item_count: input.items.length,
      selected_item_count: input.items.length,
      ai_provider: "gemini",
      ai_model: input.model,
      metadata: { failures: input.failures },
    })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const { data: digest, error: digestError } = await input.supabase.from("daily_digests")
    .upsert({
      owner_id: input.ownerId,
      digest_date: input.digestDate,
      storage_bucket: null,
      storage_path: null,
      title,
      summary: input.summary,
      item_count: input.items.length,
      run_id: run.id,
    }, { onConflict: "owner_id,digest_date" })
    .select("id")
    .single();
  if (digestError) {
    await input.supabase.from("digest_runs")
      .update({
        status: "failed",
        error: digestError.message,
        finished_at: input.now.toISOString(),
        metadata: { failures: input.failures, save_error: digestError.message },
      })
      .eq("id", run.id);
    throw new SaveDigestError(digestError.message, run.id);
  }

  return { digestId: digest.id, runId: run.id, status };
}

async function saveFailedRun(input: {
  supabase: ReturnType<typeof createClient>;
  digestDate: string;
  error: string;
  feedCount: number;
  failedFeedCount: number;
  failures: FeedFailure[];
  itemCount: number;
  model: string;
  now: Date;
  ownerId: string;
  selectedItemCount: number;
}): Promise<string | null> {
  const { data: run, error: runError } = await input.supabase.from("digest_runs")
    .insert({
      owner_id: input.ownerId,
      run_date: input.digestDate,
      status: "failed",
      finished_at: input.now.toISOString(),
      feed_count: input.feedCount,
      failed_feed_count: input.failedFeedCount,
      item_count: input.itemCount,
      selected_item_count: input.selectedItemCount,
      ai_provider: "gemini",
      ai_model: input.model,
      error: input.error,
      metadata: { failures: input.failures },
    })
    .select("id")
    .single();

  if (runError) return null;
  return run.id;
}

export function createRssSummaryHandler(deps: HandlerDeps) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const limit = parseLimit(url.searchParams.get("limit"));
      const apiKey = deps.getEnv("GEMINI_API_KEY")?.trim();
      const model = deps.getEnv("GEMINI_MODEL")?.trim() || "gemini-2.0-flash";
      const timeZone = deps.getEnv("APP_TIMEZONE")?.trim() || "Asia/Saigon";

      if (!apiKey) {
        return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500);
      }
      const ownerId = deps.getEnv("OWNER_USER_ID")?.trim();
      if (!ownerId) {
        return jsonResponse({ error: "Missing OWNER_USER_ID" }, 500);
      }

      const supabase = deps.createClient(
        requiredEnv(deps, "SUPABASE_URL"),
        requiredEnv(deps, "SUPABASE_SERVICE_ROLE_KEY"),
      );
      const now = deps.now?.() ?? new Date();
      const digestDate = formatDate(now, timeZone);
      const { data: feeds, error: feedsError } = await supabase
        .from("feeds")
        .select("id,title,url,category")
        .eq("owner_id", ownerId)
        .eq("is_active", true);
      if (feedsError) throw new Error(feedsError.message);
      if (!feeds || feeds.length === 0) {
        const error = "No active feeds found";
        const runId = await saveFailedRun({
          supabase,
          digestDate,
          error,
          feedCount: 0,
          failedFeedCount: 0,
          failures: [],
          itemCount: 0,
          model,
          now,
          ownerId,
          selectedItemCount: 0,
        });
        return jsonResponse({
          error,
          runId,
          status: "failed",
          feedCount: 0,
          failedFeedCount: 0,
          itemCount: 0,
        }, 400);
      }

      const allItems: SourceFeedItem[] = [];
      const failures: FeedFailure[] = [];

      for (const feed of feeds as FeedRow[]) {
        try {
          const feedUrl = validateFeedUrl(feed.url);
          const feedResponse = await deps.fetch(feedUrl, {
            headers: {
              "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
              "User-Agent": "Mozilla/5.0 (compatible; RSS News Summary/0.1; +https://example.com)",
            },
          });
          if (!feedResponse.ok) {
            throw new Error(`RSS request failed with status ${feedResponse.status}`);
          }

          const xml = await feedResponse.text();
          allItems.push(...parseFeedItems(xml, limit).map((item) => ({
            ...item,
            feedId: feed.id,
            feedTitle: feed.title,
            feedUrl,
            category: feed.category,
          })));
          const { error: updateError } = await supabase.from("feeds")
            .update({ last_fetched_at: now.toISOString(), last_error: null })
            .eq("id", feed.id);
          if (updateError) throw new Error(updateError.message);
        } catch (error) {
          const message = errorMessage(error);
          failures.push({ feed_id: feed.id, feed_url: feed.url, error: message });
          const { error: updateError } = await supabase.from("feeds")
            .update({ last_error: message })
            .eq("id", feed.id);
          if (updateError) {
            failures.push({
              feed_id: feed.id,
              feed_url: feed.url,
              error: updateError.message,
            });
          }
        }
      }

      if (allItems.length === 0) {
        const error = "No RSS items found";
        const runId = await saveFailedRun({
          supabase,
          digestDate,
          error,
          feedCount: feeds.length,
          failedFeedCount: failedFeedCount(failures),
          failures,
          itemCount: 0,
          model,
          now,
          ownerId,
          selectedItemCount: 0,
        });
        return jsonResponse({
          error,
          runId,
          status: "failed",
          feedCount: feeds.length,
          failedFeedCount: failedFeedCount(failures),
          itemCount: 0,
        }, 502);
      }

      let summary: string;
      try {
        summary = await summarizeWithGemini({
          apiKey,
          model,
          items: allItems,
          fetch: deps.fetch,
        });
      } catch (error) {
        const message = errorMessage(error);
        const runId = await saveFailedRun({
          supabase,
          digestDate,
          error: message,
          feedCount: feeds.length,
          failedFeedCount: failedFeedCount(failures),
          failures,
          itemCount: allItems.length,
          model,
          now,
          ownerId,
          selectedItemCount: allItems.length,
        });
        return jsonResponse({
          error: message,
          runId,
          status: "failed",
          feedCount: feeds.length,
          failedFeedCount: failedFeedCount(failures),
          itemCount: allItems.length,
        }, 502);
      }
      let saved: { digestId: string; runId: string; status: "succeeded" | "partial" };
      try {
        saved = await saveDigest({
          supabase,
          digestDate,
          feedCount: feeds.length,
          failures,
          items: allItems,
          model,
          now,
          ownerId,
          summary,
        });
      } catch (error) {
        const message = errorMessage(error);
        const runId = error instanceof SaveDigestError ? error.runId : null;
        return jsonResponse({
          error: message,
          runId,
          status: "failed",
          feedCount: feeds.length,
          failedFeedCount: failedFeedCount(failures),
          itemCount: allItems.length,
        }, 500);
      }

      return jsonResponse({
        digestId: saved.digestId,
        runId: saved.runId,
        status: saved.status,
        feedCount: feeds.length,
        failedFeedCount: failedFeedCount(failures),
        itemCount: allItems.length,
        summary,
      });
    } catch (error) {
      return jsonResponse({ error: errorMessage(error) }, 500);
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
