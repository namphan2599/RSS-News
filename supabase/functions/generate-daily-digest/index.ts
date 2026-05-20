import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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

Deno.serve(async (request) => {
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
  const { data: users, error: ownerError } = await supabase.auth.admin
    .listUsers();
  const owner = ownerError
    ? null
    : users.users.find((user) => user.email === config.ownerEmail);

  if (ownerError || !owner) {
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
    const error =
      `Digest generation already running or completed for ${targetDate}`;
    await supabase
      .from("digest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error,
      })
      .eq("id", run.id);
    return jsonResponse({ error }, 409);
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
    let insertedItemCount = 0;

    for (const feed of feeds ?? []) {
      try {
        await logEvent(supabase, "info", source, "feed_fetch_started", {
          run_id: run.id,
          feed_id: feed.id,
        });

        const response = await fetch(feed.url, {
          headers: { "User-Agent": "RSS Digest App/0.1" },
        });
        if (!response.ok) {
          throw new Error(`Fetch failed with status ${response.status}`);
        }

        const xml = await response.text();
        const parsed = await parseFeed(
          xml,
          feed.id,
          feed.url,
          config.digestDescriptionMaxChars,
        );

        await supabase
          .from("feeds")
          .update({
            title: feed.title ?? parsed.feedTitle,
            site_url: parsed.siteUrl,
            last_fetched_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", feed.id);

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
          insertedItemCount += parsed.items.length;
        }

        await logEvent(supabase, "info", source, "feed_fetch_succeeded", {
          run_id: run.id,
          feed_id: feed.id,
          item_count: parsed.items.length,
        });
      } catch (error) {
        failedFeedCount += 1;
        await supabase.from("feeds").update({
          last_error: String(error),
        }).eq("id", feed.id);
        await logEvent(supabase, "warn", source, "feed_fetch_failed", {
          run_id: run.id,
          feed_id: feed.id,
          error: String(error),
        });
      }
    }

    const start = `${targetDate}T00:00:00.000Z`;
    const end = `${targetDate}T23:59:59.999Z`;
    const { data: candidates, error: candidatesError } = await supabase
      .from("rss_items")
      .select(
        "id,title,description,url,published_at,feeds!inner(title,url,owner_id)",
      )
      .gte("fetched_at", start)
      .lte("fetched_at", end)
      .eq("feeds.owner_id", owner.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(config.digestMaxItems)
      .returns<CandidateRow[]>();

    if (candidatesError) throw candidatesError;

    const items: DigestInputItem[] = (candidates ?? []).map((item) => ({
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
        contentType: "text/markdown; charset=utf-8",
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
        item_count: insertedItemCount,
        selected_item_count: items.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })
      .eq("id", run.id);
    if (updateRunError) throw updateRunError;

    await supabase.from("digest_locks").delete().eq("digest_date", targetDate);

    await logEvent(supabase, "info", source, "digest_run_finished", {
      run_id: run.id,
      status,
    });

    return jsonResponse({ runId: run.id, date: targetDate, status });
  } catch (error) {
    await supabase
      .from("digest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: String(error),
      })
      .eq("id", run.id);

    await supabase.from("digest_locks").delete().eq("digest_date", targetDate);

    await logEvent(supabase, "error", source, "digest_run_failed", {
      run_id: run.id,
      error: String(error),
    });

    return jsonResponse({ error: String(error), runId: run.id }, 500);
  }
});
