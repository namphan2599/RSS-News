# Reddit Post Summaries Design

## Goal

Fetch Reddit posts from configured Reddit RSS feeds, summarize each post in Vietnamese with AI, save each post summary in Supabase, and expose a public frontend list showing subreddit, title, date, summary, and Reddit link.

## Scope

- Reuse the existing `feeds` table as the source of Reddit RSS URLs.
- Add a Reddit-specific summary table and public read view.
- Add a new Supabase Edge Function for Reddit post summarization.
- Add a public React page at `/reddit`.
- Keep admin feed management unchanged; users add Reddit RSS feeds like `https://www.reddit.com/r/programming/.rss` through the existing feed UI.

## Non-Goals

- Do not add a separate subreddit admin UI.
- Do not summarize non-Reddit RSS feeds in the Reddit function.
- Do not merge Reddit post summaries into daily digest blobs.
- Do not require authentication to view the Reddit news list.

## Data Model

Create `public.reddit_post_summaries` with:

- `id uuid primary key default gen_random_uuid()`
- `feed_id uuid not null references public.feeds(id) on delete cascade`
- `owner_id uuid not null references auth.users(id) on delete cascade`
- `subreddit text not null`
- `reddit_post_id text not null`
- `title text not null`
- `url text not null`
- `summary text not null`
- `summary_date date not null`
- `published_at timestamptz`
- `fetched_at timestamptz not null default now()`
- `ai_provider text not null default 'gemini'`
- `ai_model text not null`

Indexes and constraints:

- Unique `(feed_id, reddit_post_id)` for idempotent upserts.
- Index `summary_date desc` for the public list.
- Index `published_at desc` for secondary ordering.
- Index `feed_id` for ownership/feed joins.

`summary_date` is calculated from `published_at` in the configured app timezone when present. If no publish date exists, use the current run date in that timezone.

## Security And Public View

Enable RLS on `reddit_post_summaries`.

Policies:

- Owner can read rows for their own user, matching current owner-only table patterns.
- Edge Function writes use `SUPABASE_SERVICE_ROLE_KEY`, so insert/update RLS policies are not needed for frontend users.

Create `public.public_reddit_post_summaries` view selecting:

- `id`
- `summary_date`
- `subreddit`
- `title`
- `url`
- `summary`
- `published_at`
- `fetched_at`

Grant `select` on this view to `anon` and `authenticated`, mirroring `public_daily_digests`.

## Edge Function

Add `supabase/functions/reddit-summary/index.ts`.

Inputs:

- Optional `limit` query parameter, default 10 and max 25 per feed.
- Environment: `GEMINI_API_KEY`, `GEMINI_MODEL`, `APP_TIMEZONE`, `OWNER_USER_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- The function is configured with `verify_jwt = false` because it is invoked by Supabase cron, not the frontend.

Flow:

1. Read active feeds for `OWNER_USER_ID`.
2. Keep feeds whose URL matches Reddit RSS shape, such as `https://www.reddit.com/r/<subreddit>/.rss`.
3. Fetch each Reddit feed with Reddit-friendly RSS headers already used in `reddit-rss-test`.
4. Parse Atom/RSS entries into title, URL, content/snippet, published date, and stable Reddit post id.
5. Query existing summaries for `(feed_id, reddit_post_id)` and skip saved posts.
6. Summarize each new post with Gemini in Vietnamese.
7. Upsert each summary into `reddit_post_summaries`.
8. Update successful feeds with `last_fetched_at` and clear `last_error`.
9. Update failed feeds with `last_error` and continue processing other feeds.
10. Return JSON counts: scanned feeds, Reddit feeds, posts found, posts summarized, skipped posts, failed feeds, and failures.

Prompt requirements:

- Write one concise Vietnamese summary per Reddit post.
- Stay factual and avoid clickbait.
- Use RSS title/content as available context.
- Preserve uncertainty when post content is thin.
- Do not invent details.

Failures:

- One bad subreddit feed does not fail the whole run.
- Missing required env values returns a 500 JSON error.
- No Reddit feeds returns a 400 JSON error with zero counts.
- No new posts returns 200 with `postsSummarized: 0`.

## Frontend

Add `src/api/redditPostsApi.ts`:

- `RedditPostSummary` type.
- `listRedditPostSummaries(limit = 50)` querying `public_reddit_post_summaries` ordered by `summary_date desc`, then `published_at desc`, then `fetched_at desc`.

Add `src/pages/RedditNewsPage.tsx`:

- Public page mounted at `/reddit`.
- Page title `Reddit News`.
- Intro explaining these are Vietnamese summaries from configured Reddit RSS feeds.
- Loading, error, and empty states reuse existing components.
- Cards show `r/<subreddit>`, title, summary date, optional published time, summary, and link to Reddit post.

Navigation:

- Add a small link from `/digests` to `/reddit`.
- Add a small link from `/reddit` back to `/digests`.
- Keep `AppShell` structure unchanged.

## Tests

Edge Function tests:

- Detect Reddit feed URL and extract subreddit.
- Parse Reddit Atom entries including title, URL, content, published date, and post id.
- Skip already-saved posts.
- Build Gemini prompt containing Vietnamese summary instruction and post fields.
- Save summaries with `summary_date` derived from `published_at` in `APP_TIMEZONE`.
- Continue when one feed fails.

Frontend verification:

- Build TypeScript through `npm run build`.
- Add focused tests only if existing test setup makes page/API testing cheap and stable.

## Verification

Run:

- `deno test supabase/functions/reddit-summary/index.test.ts`
- `npm run lint`
- `npm run build`

If Supabase generated types are absent, rely on explicit local TypeScript types for the new API module.
