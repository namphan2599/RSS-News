# Reddit Feeds Table Design

## Goal

Manage Reddit subreddit RSS sources in a dedicated table instead of reusing the generic `feeds` table. The `reddit-summary` Edge Function will read active Reddit feeds from that table, fetch each RSS feed, summarize new posts with Gemini, and save summaries as before.

## Schema

Add `public.reddit_feeds`:

- `id uuid primary key default gen_random_uuid()`
- `owner_id uuid not null references auth.users(id) on delete cascade`
- `subreddit text not null`
- `url text not null unique`
- `is_active boolean not null default true`
- `last_fetched_at timestamptz`
- `last_error text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique (owner_id, subreddit)`

Enable RLS and mirror owner-only read/write policies used by `feeds`. Add `updated_at` trigger using existing `public.set_updated_at()`.

Update `public.reddit_post_summaries.feed_id` to reference `public.reddit_feeds(id)` instead of `public.feeds(id)`. Keep column name `feed_id` and unique constraint `(feed_id, reddit_post_id)` to avoid broad application changes.

Migration will copy existing Reddit RSS rows from `public.feeds` into `public.reddit_feeds`, remap existing `reddit_post_summaries.feed_id` values to the copied Reddit feed ids, then replace the foreign key.

## Edge Function

`supabase/functions/reddit-summary/index.ts` will query `reddit_feeds` with `owner_id = OWNER_USER_ID` and `is_active = true`. Because the new table is Reddit-only, no generic feed scan is needed.

The function will still validate each URL with `extractRedditFeedInfo()` before fetch so invalid rows produce per-feed failures instead of unsafe fetches. On success it updates `reddit_feeds.last_fetched_at` and clears `last_error`. On failure it writes `reddit_feeds.last_error`.

Response counters keep current names for API stability:

- `scannedFeedCount`: active rows read from `reddit_feeds`
- `redditFeedCount`: valid Reddit RSS rows processed
- `postsFound`, `postsSummarized`, `skippedPosts`, `failedFeedCount`, `failures`

## Tests

Update `reddit-summary` tests so fake Supabase handles `reddit_feeds` instead of `feeds`. Keep parser, prompt, date, skip, save, and partial failure coverage. Assertions should verify updates target `reddit_feeds` and upserts still target `reddit_post_summaries` with `feed_id` set to the Reddit feed id.

## Verification

Run focused Deno tests for `supabase/functions/reddit-summary/index.test.ts`. Run broader project verification if TypeScript or app contracts are affected beyond the Edge Function.
