import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createAiProvider } from "../_shared/ai/providerFactory.ts";
import type { DigestInputItem, DigestSummary } from "../_shared/ai/types.ts";
import { getConfig } from "../_shared/config.ts";
import { digestStoragePath, formatDateInTimezone } from "../_shared/dates.ts";
import { renderDigestMarkdown } from "../_shared/digestMarkdown.ts";
import { logEvent } from "../_shared/logging.ts";
import { parseFeed } from "../_shared/rss.ts";

type FeedRow = {
  id: string;
  owner_id: string;
  title: string | null;
  url: string;
};

type CandidateRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  published_at: string | null;
  feeds: { title: string | null; url: string; owner_id: string } | null;
};

type RunRow = {
  id: string;
};

const source = "generate-daily-digest";
const feedFetchTimeoutMs = 15_000;
const maxFeedResponseBytes = 2 * 1024 * 1024;
const ownerLookupPageSize = 100;
type DigestSupabaseClient = SupabaseClient<any, "public", any>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fallbackDigest(date: string, items: DigestInputItem[]): DigestSummary {
  return {
    title: `Daily Digest: ${date}`,
    executiveSummary:
      "AI summarization was unavailable, so this digest contains the selected RSS links.",
    sections: [
      {
        heading: "Links",
        bullets: items.map((item) => ({
          title: item.title,
          summary: item.description || "No RSS description was provided.",
          url: item.url,
          source: item.feedTitle,
        })),
      },
    ],
    moreLinks: [],
  };
}

function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === date;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getLocalParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localWallTimeMs(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function localMidnightToUtc(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = new Date(desired);

  for (let index = 0; index < 4; index += 1) {
    const actual = localWallTimeMs(getLocalParts(candidate, timezone));
    const delta = desired - actual;
    if (delta === 0) return candidate;
    candidate = new Date(candidate.getTime() + delta);
  }

  return candidate;
}

export function getLocalDayUtcBounds(
  date: string,
  timezone: string,
): { start: string; end: string } {
  const start = localMidnightToUtc(date, timezone);
  const end = localMidnightToUtc(addDays(date, 1), timezone);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function limitCandidatesPerFeed<T extends {
  feeds: { url: string } | null;
}>(
  candidates: T[],
  maxItemsPerFeed: number,
  maxItems: number,
): T[] {
  const countsByFeed = new Map<string, number>();
  const selected: T[] = [];

  for (const candidate of candidates) {
    const feedKey = candidate.feeds?.url ?? `item:${selected.length}`;
    const count = countsByFeed.get(feedKey) ?? 0;
    if (count >= maxItemsPerFeed) continue;

    countsByFeed.set(feedKey, count + 1);
    selected.push(candidate);
    if (selected.length >= maxItems) break;
  }

  return selected;
}

function sanitizeDigestUrls(
  digest: DigestSummary,
  allowedUrls: Set<string>,
): DigestSummary {
  const sanitizeUrl = (url: string): string => allowedUrls.has(url) ? url : "#";

  return {
    ...digest,
    sections: digest.sections.map((section) => ({
      ...section,
      bullets: section.bullets.map((bullet) => ({
        ...bullet,
        url: sanitizeUrl(bullet.url),
      })),
    })),
    moreLinks: digest.moreLinks?.map((link) => ({
      ...link,
      url: sanitizeUrl(link.url),
    })),
  };
}

function isConflictError(error: { code?: string; message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "23505" ||
    message.includes("duplicate key") ||
    message.includes("already exists");
}

function validateFeedUrl(feedUrl: string): string {
  const parsed = new URL(feedUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported feed URL scheme: ${parsed.protocol}`);
  }
  return parsed.toString();
}

async function readResponseTextWithCap(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`Feed response exceeds ${maxBytes} bytes`);
  }

  if (!response.body) {
    return await response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Feed response exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

async function fetchFeedXml(feedUrl: string): Promise<string> {
  const url = validateFeedUrl(feedUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), feedFetchTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "RSS Digest App/0.1" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    return await readResponseTextWithCap(response, maxFeedResponseBytes);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Feed fetch timed out after ${feedFetchTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function findOwnerUser(
  supabase: DigestSupabaseClient,
  ownerEmail: string,
): Promise<{ id: string } | null> {
  const normalizedOwnerEmail = ownerEmail.toLowerCase();

  for (let page = 1; page < Number.MAX_SAFE_INTEGER; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: ownerLookupPageSize,
    });
    if (error) throw error;

    const owner = data.users.find((user) =>
      user.email?.toLowerCase() === normalizedOwnerEmail
    );
    if (owner) return owner;

    if (data.users.length < ownerLookupPageSize) break;
  }

  return null;
}

async function logLockCleanupFailure(
  supabase: DigestSupabaseClient,
  runId: string,
  targetDate: string,
  error: unknown,
): Promise<void> {
  console.error("Failed to delete digest lock", error);
  await logEvent(supabase, "error", source, "digest_lock_cleanup_failed", {
    run_id: runId,
    digest_date: targetDate,
    error: String(error),
  }).catch((logError) => {
    console.error("Failed to log digest lock cleanup failure", logError);
  });
}

async function deleteDigestLock(
  supabase: DigestSupabaseClient,
  runId: string,
  targetDate: string,
): Promise<void> {
  const { error } = await supabase.from("digest_locks").delete().eq(
    "digest_date",
    targetDate,
  );
  if (error) {
    await logLockCleanupFailure(supabase, runId, targetDate, error);
  }
}

export async function handleGenerateDailyDigest(request: Request) {
  const config = getConfig();
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (token !== config.cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const targetDate = typeof body.date === "string"
    ? body.date
    : formatDateInTimezone(new Date(), config.timezone);

  if (!isValidDateString(targetDate)) {
    return jsonResponse({ error: "date must use YYYY-MM-DD" }, 400);
  }

  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );
  let owner: { id: string } | null = null;
  try {
    owner = await findOwnerUser(supabase, config.ownerEmail);
  } catch (error) {
    console.error("Owner lookup failed", error);
    return jsonResponse({ error: "Owner user lookup failed" }, 500);
  }

  if (!owner) {
    return jsonResponse({ error: "Owner user not found" }, 500);
  }

  const { data: run, error: runError } = await supabase
    .from("digest_runs")
    .insert({
      owner_id: owner.id,
      run_date: targetDate,
      status: "running",
      ai_provider: config.aiProvider,
      ai_model: config.geminiModel,
    })
    .select("id")
    .returns<RunRow[]>()
    .single();

  if (runError) {
    return jsonResponse({ error: runError.message }, 500);
  }

  const { error: lockError } = await supabase
    .from("digest_locks")
    .insert({ digest_date: targetDate, run_id: run.id });

  if (lockError) {
    const conflict = isConflictError(lockError);
    const error = conflict
      ? `Digest generation already running or completed for ${targetDate}`
      : `Failed to acquire digest lock: ${lockError.message}`;
    const { error: updateRunError } = await supabase
      .from("digest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error,
      })
      .eq("id", run.id);
    if (updateRunError) {
      console.error("Failed to mark run failed after lock error", updateRunError);
    }
    return jsonResponse({ error }, conflict ? 409 : 500);
  }

  await logEvent(supabase, "info", source, "digest_run_started", {
    run_id: run.id,
    digest_date: targetDate,
  });

  try {
    const { data: feeds, error: feedsError } = await supabase
      .from("feeds")
      .select("id, owner_id, title, url")
      .eq("owner_id", owner.id)
      .eq("is_active", true)
      .returns<FeedRow[]>();

    if (feedsError) throw feedsError;

    let failedFeedCount = 0;
    let parsedItemCount = 0;

    for (const feed of feeds ?? []) {
      try {
        await logEvent(supabase, "info", source, "feed_fetch_started", {
          run_id: run.id,
          feed_id: feed.id,
        });

        const xml = await fetchFeedXml(feed.url);
        const parsed = await parseFeed(
          xml,
          feed.id,
          feed.url,
          config.digestDescriptionMaxChars,
        );

        const { error: updateFeedError } = await supabase
          .from("feeds")
          .update({
            title: feed.title ?? parsed.feedTitle,
            site_url: parsed.siteUrl,
            last_fetched_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", feed.id);
        if (updateFeedError) {
          await logEvent(supabase, "warn", source, "feed_metadata_update_failed", {
            run_id: run.id,
            feed_id: feed.id,
            error: String(updateFeedError),
          });
          throw updateFeedError;
        }

        if (parsed.items.length > 0) {
          const { error: insertError } = await supabase.from("rss_items")
            .upsert(
              parsed.items.map((item) => ({
                feed_id: item.feedId,
                guid: item.guid,
                url: item.url,
                normalized_url: item.normalizedUrl,
                title: item.title,
                description: item.description,
                published_at: item.publishedAt,
                content_hash: item.contentHash,
              })),
              { onConflict: "feed_id,content_hash", ignoreDuplicates: true },
            );
          if (insertError) throw insertError;
          parsedItemCount += parsed.items.length;
        }

        await logEvent(supabase, "info", source, "feed_fetch_succeeded", {
          run_id: run.id,
          feed_id: feed.id,
          item_count: parsed.items.length,
        });
      } catch (error) {
        failedFeedCount += 1;
        const { error: updateFeedError } = await supabase.from("feeds").update({
          last_error: String(error),
        }).eq("id", feed.id);
        if (updateFeedError) {
          await logEvent(supabase, "warn", source, "feed_metadata_update_failed", {
            run_id: run.id,
            feed_id: feed.id,
            error: String(updateFeedError),
          });
        }
        await logEvent(supabase, "warn", source, "feed_fetch_failed", {
          run_id: run.id,
          feed_id: feed.id,
          error: String(error),
        });
      }
    }

    const { start, end } = getLocalDayUtcBounds(targetDate, config.timezone);
    const { data: candidates, error: candidatesError } = await supabase
      .from("rss_items")
      .select(
        "id,title,description,url,published_at,feeds!inner(title,url,owner_id)",
      )
      .gte("fetched_at", start)
      .lt("fetched_at", end)
      .eq("feeds.owner_id", owner.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(config.digestMaxItems * Math.max(config.digestMaxItemsPerFeed, 1))
      .returns<CandidateRow[]>();

    if (candidatesError) throw candidatesError;

    const limitedCandidates = limitCandidatesPerFeed(
      candidates ?? [],
      config.digestMaxItemsPerFeed,
      config.digestMaxItems,
    );

    const items: DigestInputItem[] = limitedCandidates.map((item) => ({
      id: item.id,
      feedTitle: item.feeds?.title ?? item.feeds?.url ?? "Unknown source",
      title: item.title,
      url: item.url,
      publishedAt: item.published_at ?? undefined,
      description: item.description ?? undefined,
    }));

    let digest: DigestSummary;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let status: "succeeded" | "partial" = failedFeedCount > 0
      ? "partial"
      : "succeeded";

    if (items.length === 0) {
      digest = {
        title: `Daily Digest: ${targetDate}`,
        executiveSummary: "No RSS items were found for this date.",
        sections: [],
        moreLinks: [],
      };
    } else {
      try {
        await logEvent(supabase, "info", source, "ai_summary_started", {
          run_id: run.id,
          selected_item_count: items.length,
        });
        const provider = createAiProvider(config);
        const result = await provider.summarizeDailyDigest({
          date: targetDate,
          items,
          maxItems: config.digestMaxItems,
          maxOutputTokens: config.digestMaxOutputTokens,
        });
        digest = result.digest;
        inputTokens = result.usage?.inputTokens;
        outputTokens = result.usage?.outputTokens;
      } catch (error) {
        status = "partial";
        digest = fallbackDigest(targetDate, items);
        await logEvent(supabase, "warn", source, "ai_summary_failed", {
          run_id: run.id,
          error: String(error),
        });
      }
    }

    digest = sanitizeDigestUrls(
      digest,
      new Set(items.map((item) => item.url)),
    );

    const generatedAt = `${new Date().toISOString()} ${config.timezone}`;
    const markdown = renderDigestMarkdown({
      date: targetDate,
      generatedAt,
      feedCount: feeds?.length ?? 0,
      itemCount: items.length,
      provider: config.aiProvider,
      model: config.geminiModel,
      runId: run.id,
      digest,
    });
    const storagePath = digestStoragePath(targetDate);
    const { error: uploadError } = await supabase.storage
      .from("digests")
      .upload(storagePath, markdown, {
        contentType: "text/markdown",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: digestError } = await supabase.from("daily_digests").upsert(
      {
        owner_id: owner.id,
        digest_date: targetDate,
        storage_bucket: "digests",
        storage_path: storagePath,
        title: digest.title,
        summary: digest.executiveSummary,
        item_count: items.length,
        run_id: run.id,
      },
      { onConflict: "owner_id,digest_date" },
    );
    if (digestError) throw digestError;

    const { error: updateRunError } = await supabase
      .from("digest_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        feed_count: feeds?.length ?? 0,
        failed_feed_count: failedFeedCount,
        item_count: parsedItemCount,
        selected_item_count: items.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })
      .eq("id", run.id);
    if (updateRunError) throw updateRunError;

    await deleteDigestLock(supabase, run.id, targetDate);

    await logEvent(supabase, "info", source, "digest_run_finished", {
      run_id: run.id,
      status,
    });

    return jsonResponse({ runId: run.id, date: targetDate, status });
  } catch (error) {
    const { error: updateRunError } = await supabase
      .from("digest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: String(error),
      })
      .eq("id", run.id);
    if (updateRunError) {
      console.error("Failed to mark digest run failed", updateRunError);
    }

    await deleteDigestLock(supabase, run.id, targetDate);

    await logEvent(supabase, "error", source, "digest_run_failed", {
      run_id: run.id,
      error: String(error),
    });

    return jsonResponse({ error: String(error), runId: run.id }, 500);
  }
}

if (import.meta.main) {
  Deno.serve(handleGenerateDailyDigest);
}
