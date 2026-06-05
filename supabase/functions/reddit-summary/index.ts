import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type RedditFeedInfo = {
  subreddit: string;
  url: string;
};

export type RedditFeedItem = {
  redditPostId: string;
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
};

type HandlerDeps = {
  createClient: typeof createClient;
  fetch: typeof fetch;
  getEnv: (name: string) => string | undefined | null;
  now?: () => Date;
};

type FeedRow = {
  id: string;
  title: string | null;
  url: string;
};

type FeedFailure = {
  feed_id: string;
  feed_url: string;
  error: string;
};

type SourceRedditItem = RedditFeedItem & {
  feedId: string;
  subreddit: string;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

export function extractRedditFeedInfo(feedUrl: string): RedditFeedInfo | null {
  const parsed = new URL(feedUrl.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https");
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "reddit.com" && host !== "www.reddit.com") return null;

  const pathMatch = /^\/r\/([^/.]+)\.rss$/i.exec(parsed.pathname) ??
    /^\/r\/([^/]+)\/\.rss\/?$/i.exec(parsed.pathname);
  const subreddit = pathMatch?.[1];
  if (!subreddit) return null;

  return { subreddit, url: parsed.toString() };
}

function postIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return /\/comments\/([^/]+)/i.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function stablePostId(entry: string, url: string): string {
  const id = firstMatch(entry, /<id[^>]*>([\s\S]*?)<\/id>/i);
  const fromUrl = postIdFromUrl(url) ?? postIdFromUrl(id);
  return fromUrl ?? id.replace(/^t3_/, "");
}

function parseAtomEntry(entry: string): RedditFeedItem {
  const url = firstMatch(entry, /<link[^>]+href="([^"]+)"/i);
  return {
    redditPostId: stablePostId(entry, url),
    title: stripTags(firstMatch(entry, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    url,
    content: stripTags(firstMatch(
      entry,
      /<(?:content|summary)[^>]*>([\s\S]*?)<\/(?:content|summary)>/i,
    )),
    publishedAt: firstMatch(entry, /<(?:published|updated)[^>]*>([\s\S]*?)<\/(?:published|updated)>/i) || null,
  };
}

function parseRssItem(item: string): RedditFeedItem {
  const url = firstMatch(item, /<link[^>]*>([\s\S]*?)<\/link>/i);
  return {
    redditPostId: stablePostId(item, url),
    title: stripTags(firstMatch(item, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    url,
    content: stripTags(firstMatch(
      item,
      /<(?:description|content:encoded|summary)[^>]*>([\s\S]*?)<\/(?:description|content:encoded|summary)>/i,
    )),
    publishedAt: firstMatch(item, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || null,
  };
}

export function parseFeedItems(xml: string, limit: number): RedditFeedItem[] {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items = rssItems.length > 0 ? rssItems.map(parseRssItem) : atomEntries.map(parseAtomEntry);

  return items
    .filter((item) => item.redditPostId && item.title && item.url)
    .slice(0, limit);
}

export function formatDate(date: Date, timeZone: string): string {
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
    throw new Error(`Could not format date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function summaryDateForItem(publishedAt: string | null, now: Date, timeZone: string): string {
  const date = publishedAt ? new Date(publishedAt) : now;
  if (Number.isNaN(date.getTime())) return formatDate(now, timeZone);
  return formatDate(date, timeZone);
}

export function buildPrompt(item: { subreddit: string; title: string; url: string; content: string }): string {
  return [
    "Tóm tắt bài Reddit các các comments sau bằng tiếng Việt.",
    "Phân bổ các ý chinh theo mức độ quan trọng, tập trung vào những điểm nổi bật và thông tin hữu ích nhất.",
    "Chỉ dùng thông tin có trong tiêu đề, nội dung RSS, và URL được cung cấp.",
    "Nếu nội dung mỏng hoặc chưa chắc chắn, hãy nói thận trọng.",
    "Không bịa thêm chi tiết.",
    "",
    JSON.stringify({
      subreddit: `r/${item.subreddit}`,
      title: item.title,
      url: item.url,
      content: item.content,
    }),
  ].join("\n");
}

async function summarizeWithGemini(input: {
  apiKey: string;
  model: string;
  item: SourceRedditItem;
  fetch: typeof fetch;
}): Promise<string> {
  const response = await input.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: buildPrompt(input.item) }],
        }],
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);

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

async function existingPostIds(input: {
  supabase: ReturnType<typeof createClient>;
  feedId: string;
  postIds: string[];
}): Promise<Set<string>> {
  if (input.postIds.length === 0) return new Set();

  const { data, error } = await input.supabase
    .from("reddit_post_summaries")
    .select("reddit_post_id")
    .eq("feed_id", input.feedId)
    .in("reddit_post_id", input.postIds);
  if (error) throw new Error(error.message);

  return new Set((data ?? []).map((row: { reddit_post_id: string }) => row.reddit_post_id));
}

export function createRedditSummaryHandler(deps: HandlerDeps) {
  return async (request: Request): Promise<Response> => {
    try {
      const requestUrl = new URL(request.url);
      const limit = parseLimit(requestUrl.searchParams.get("limit"));
      const apiKey = deps.getEnv("GEMINI_API_KEY")?.trim();
      const model = deps.getEnv("GEMINI_MODEL")?.trim() || "gemini-2.0-flash";
      const timeZone = deps.getEnv("APP_TIMEZONE")?.trim() || "Asia/Saigon";

      if (!apiKey) return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500);
      const ownerId = deps.getEnv("OWNER_USER_ID")?.trim();
      if (!ownerId) return jsonResponse({ error: "Missing OWNER_USER_ID" }, 500);

      const supabase = deps.createClient(
        requiredEnv(deps, "SUPABASE_URL"),
        requiredEnv(deps, "SUPABASE_SERVICE_ROLE_KEY"),
      );
      const now = deps.now?.() ?? new Date();

      const { data: feeds, error: feedsError } = await supabase
        .from("feeds")
        .select("id,title,url")
        .eq("owner_id", ownerId)
        .eq("is_active", true);
      if (feedsError) throw new Error(feedsError.message);

      const feedRows = (feeds ?? []) as FeedRow[];
      const redditFeeds: { feed: FeedRow; info: RedditFeedInfo }[] = [];
      const failures: FeedFailure[] = [];

      for (const feed of feedRows) {
        try {
          const info = extractRedditFeedInfo(feed.url);
          if (info) redditFeeds.push({ feed, info });
        } catch (error) {
          failures.push({ feed_id: feed.id, feed_url: feed.url, error: errorMessage(error) });
        }
      }

      if (redditFeeds.length === 0) {
        return jsonResponse({
          error: "No active Reddit feeds found",
          scannedFeedCount: feedRows.length,
          redditFeedCount: 0,
          postsFound: 0,
          postsSummarized: 0,
          skippedPosts: 0,
          failedFeedCount: new Set(failures.map((failure) => failure.feed_id)).size,
          failures,
        }, 400);
      }

      let postsFound = 0;
      let postsSummarized = 0;
      let skippedPosts = 0;

      for (const { feed, info } of redditFeeds) {
        try {
          const feedResponse = await deps.fetch(info.url, {
            headers: {
              "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
              "User-Agent": "Mozilla/5.0 (compatible; RSS News Summary/0.1; +https://example.com)",
            },
          });
          if (!feedResponse.ok) throw new Error(`Reddit RSS request failed with status ${feedResponse.status}`);

          const xml = await feedResponse.text();
          const items = parseFeedItems(xml, limit).map((item) => ({
            ...item,
            feedId: feed.id,
            subreddit: info.subreddit,
          }));
          postsFound += items.length;

          const savedIds = await existingPostIds({
            supabase,
            feedId: feed.id,
            postIds: items.map((item) => item.redditPostId),
          });
          const newItems = items.filter((item) => !savedIds.has(item.redditPostId));
          skippedPosts += items.length - newItems.length;

          for (const item of newItems) {
            const summary = await summarizeWithGemini({ apiKey, model, item, fetch: deps.fetch });
            const row = {
              owner_id: ownerId,
              feed_id: feed.id,
              subreddit: info.subreddit,
              reddit_post_id: item.redditPostId,
              title: item.title,
              url: item.url,
              summary,
              summary_date: summaryDateForItem(item.publishedAt, now, timeZone),
              published_at: item.publishedAt,
              fetched_at: now.toISOString(),
              ai_provider: "gemini",
              ai_model: model,
            };

            const { error: upsertError } = await supabase
              .from("reddit_post_summaries")
              .upsert([row], { onConflict: "feed_id,reddit_post_id" });
            if (upsertError) throw new Error(upsertError.message);
            postsSummarized += 1;
          }

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
            failures.push({ feed_id: feed.id, feed_url: feed.url, error: updateError.message });
          }
        }
      }

      return jsonResponse({
        scannedFeedCount: feedRows.length,
        redditFeedCount: redditFeeds.length,
        postsFound,
        postsSummarized,
        skippedPosts,
        failedFeedCount: new Set(failures.map((failure) => failure.feed_id)).size,
        failures,
      });
    } catch (error) {
      return jsonResponse({ error: errorMessage(error) }, 500);
    }
  };
}

export const handler = createRedditSummaryHandler({
  createClient,
  fetch,
  getEnv: (name) => Deno.env.get(name),
});

if (import.meta.main) {
  Deno.serve(handler);
}
