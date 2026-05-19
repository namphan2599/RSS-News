# RSS Digest App Design

Date: 2026-05-19
Status: Ready for user review
Scope: Single-user private MVP

## 1. MVP Scope

Build a private web app that collects RSS feeds, generates one AI-assisted Markdown digest per day, stores that Markdown file in Supabase Storage, and renders past daily digests in the frontend.

The MVP includes:

- A feed list for one owner.
- RSS/Atom fetching from configured feeds.
- Item extraction using RSS title, description, link, publication date, source, and GUID when available.
- Deduplication by feed and normalized content hash.
- Daily digest generation with Gemini through a provider abstraction.
- One Markdown file per calendar day.
- Postgres metadata for feeds, items, generation runs, and digests.
- Private Storage bucket for Markdown files.
- Frontend pages to browse digest dates, read a digest, and manage feeds.
- Daily generation through Supabase Cron.

The MVP excludes:

- Full article scraping.
- Multi-user/team support.
- Email delivery.
- Embeddings, semantic search, and recommendations.
- Per-feed summarization preferences.
- Desktop packaging.
- Advanced queueing.

These exclusions are intentional. The app should first prove the daily RSS-to-Markdown workflow with low token use and predictable operations.

## 2. System Architecture

Use Supabase as the backend boundary:

- Supabase Postgres stores metadata and run state.
- Supabase Storage stores durable Markdown digest files.
- Supabase Edge Functions perform RSS fetching, AI summarization, Markdown generation, and controlled Storage reads.
- Supabase Cron schedules daily generation.
- The frontend uses Supabase auth and app APIs, but never receives service-role credentials or AI provider keys.

Recommended MVP flow:

```text
Supabase Cron
  -> generate-daily-digest Edge Function
    -> acquire date-level generation lock
    -> load active feeds
    -> fetch RSS/Atom XML
    -> parse title, description, link, date, GUID
    -> normalize and dedupe items
    -> insert new rss_items
    -> select digest candidates
    -> call AI provider through AiProvider interface
    -> render deterministic Markdown locally
    -> upload Markdown to Storage
    -> upsert daily_digests metadata
    -> update digest_runs status

Frontend
  -> list daily_digests from Postgres
  -> request Markdown through get-digest Edge Function
  -> render Markdown safely
```

The first implementation should keep fetching and generation in one function. Splitting into separate scheduled fetch and generate steps can happen after the basic pipeline is stable.

## 3. Supabase Database Schema

The app is single-user, so the schema does not need tenant abstractions. Still, each user-facing table can include an `owner_id` for clean RLS and future migration.

### `feeds`

Stores the configured RSS feeds.

```sql
create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  url text not null unique,
  site_url text,
  category text,
  is_active boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `rss_items`

Stores fetched feed items and supports deduplication.

```sql
create table public.rss_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  guid text,
  url text not null,
  normalized_url text,
  title text not null,
  description text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  unique (feed_id, content_hash)
);

create index rss_items_published_at_idx on public.rss_items (published_at desc);
create index rss_items_fetched_at_idx on public.rss_items (fetched_at desc);
```

### `digest_runs`

Tracks each generation attempt.

```sql
create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  feed_count int not null default 0,
  failed_feed_count int not null default 0,
  item_count int not null default 0,
  selected_item_count int not null default 0,
  input_tokens int,
  output_tokens int,
  ai_provider text,
  ai_model text,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create index digest_runs_run_date_idx on public.digest_runs (run_date desc);
```

### `daily_digests`

Stores one row per generated daily Markdown file.

```sql
create table public.daily_digests (
  id uuid primary key default gen_random_uuid(),
  digest_date date not null unique,
  storage_bucket text not null default 'digests',
  storage_path text not null,
  title text not null,
  summary text,
  item_count int not null default 0,
  run_id uuid references public.digest_runs(id),
  generated_at timestamptz not null default now()
);

create index daily_digests_digest_date_idx on public.daily_digests (digest_date desc);
```

### `app_logs`

Optional but recommended for MVP debugging.

```sql
create table public.app_logs (
  id bigint generated always as identity primary key,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index app_logs_created_at_idx on public.app_logs (created_at desc);
```

## 4. Storage Structure

Create one private Supabase Storage bucket:

```text
digests
```

Store Markdown files by date:

```text
daily/
  2026/
    05/
      2026-05-19.md
```

The full path for 2026-05-19 is:

```text
daily/2026/05/2026-05-19.md
```

The database stores this path in `daily_digests.storage_path`. The frontend should not access the bucket directly in the MVP. Instead, it should call `get-digest`, which reads the file with server-side credentials after checking auth.

## 5. Edge Functions

### `generate-daily-digest`

Primary scheduled job.

Inputs:

- Optional `date`, defaulting to the current date in the configured app timezone.
- Optional `force`, defaulting to `false`.

Responsibilities:

- Validate invocation using `CRON_SECRET` or authenticated admin session.
- Acquire a Postgres advisory lock for the target date.
- Create a `digest_runs` row with `running`.
- Fetch every active feed.
- Parse RSS/Atom items.
- Clean descriptions by stripping HTML and truncating long text.
- Normalize item URLs.
- Compute `content_hash` from feed ID, GUID or URL, title, and date.
- Insert new `rss_items`, ignoring duplicates.
- Select digest candidates for the target day.
- Apply item caps and per-feed caps.
- Call the configured AI provider.
- Validate the provider response.
- Render Markdown locally.
- Upload Markdown to Storage with upsert.
- Upsert `daily_digests`.
- Mark the run `succeeded`, `partial`, or `failed`.

Failure behavior:

- If one feed fails, continue with other feeds.
- If all feeds fail, mark run `failed`.
- If AI fails but items exist, generate a fallback Markdown link list and mark run `partial`.
- If Storage upload fails, mark run `failed`.

### `get-digest`

Controlled Markdown reader for the frontend.

Inputs:

- `date` in `YYYY-MM-DD` format.

Responsibilities:

- Require authenticated user.
- Load matching `daily_digests` metadata.
- Download Markdown from the private Storage bucket.
- Return `text/markdown; charset=utf-8`.

### `fetch-rss`

Deferred until needed.

This can later separate frequent feed ingestion from daily AI generation. It should reuse the same parsing and dedupe modules as `generate-daily-digest`.

## 6. AI Provider Interface

The app starts with Gemini but should keep model-specific code behind a narrow interface.

```ts
export type DigestInputItem = {
  id: string;
  feedTitle: string;
  title: string;
  url: string;
  publishedAt?: string;
  description?: string;
};

export type DigestSummary = {
  title: string;
  executiveSummary: string;
  sections: Array<{
    heading: string;
    bullets: Array<{
      title: string;
      summary: string;
      url: string;
      source: string;
    }>;
  }>;
  moreLinks?: Array<{
    title: string;
    url: string;
    source: string;
  }>;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProvider {
  name: string;
  model: string;

  summarizeDailyDigest(input: {
    date: string;
    items: DigestInputItem[];
    maxItems: number;
    maxOutputTokens: number;
  }): Promise<{
    digest: DigestSummary;
    usage?: AiUsage;
    raw?: unknown;
  }>;
}
```

Initial implementation:

```text
supabase/functions/_shared/ai/types.ts
supabase/functions/_shared/ai/providerFactory.ts
supabase/functions/_shared/ai/providers/gemini.ts
```

Future providers:

```text
openai.ts
claude.ts
ollama.ts
```

Provider-specific code may handle authentication, response parsing, token counting, and retry behavior. The rest of the app should only consume `DigestSummary`.

## 7. Token Optimization Strategy

The MVP should minimize token usage by design:

- Use RSS title and description only.
- Strip HTML, scripts, styles, entities, and repeated whitespace.
- Truncate descriptions to 300-600 characters.
- Cap the daily digest to a configurable maximum, default 60 items.
- Cap each feed to a configurable maximum, default 8 items.
- Sort candidates by published date, then fetched date.
- Deduplicate by normalized URL and similar title before calling AI.
- Send compact JSON to the model with short field names if needed.
- Ask for structured JSON, not Markdown.
- Render Markdown locally.
- Skip AI generation when no candidate items exist.
- Track `input_tokens` and `output_tokens` where the provider supports it.
- Store model name and provider name with every run.

Default environment values:

```text
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash
DIGEST_MAX_ITEMS=60
DIGEST_MAX_ITEMS_PER_FEED=8
DIGEST_DESCRIPTION_MAX_CHARS=500
DIGEST_MAX_OUTPUT_TOKENS=2500
APP_TIMEZONE=Asia/Saigon
```

Model names may change over time, so the implementation should read the Gemini model from configuration instead of hard-coding it throughout the app.

## 8. Markdown Digest Template

Markdown should be deterministic and generated by local code from the validated `DigestSummary`.

```md
# Daily Digest: 2026-05-19

Generated: 2026-05-19 07:00 Asia/Saigon
Sources: 12 feeds, 48 items
Provider: gemini / gemini-2.0-flash

## Executive Summary

{executiveSummary}

## {Section Heading}

- **[{Item Title}]({Item URL})** - {summary}
  Source: {source}

## More Links

- [{Item Title}]({Item URL}) - {source}

---

Run: {runId}
```

Rules:

- Keep generated Markdown readable in plain text.
- Preserve original item URLs.
- Do not include raw HTML from feeds.
- Escape Markdown-sensitive characters in titles and source names.
- Keep provider/run metadata at the bottom.

## 9. Summarization Prompt

Use a short system instruction plus compact item input.

```text
You create concise daily RSS digests.

Use only the provided RSS title, description, source, date, and URL.
Do not infer facts beyond the provided text.
Group related stories into 3-6 useful sections.
Prefer concise summaries over commentary.
Deduplicate similar stories.
Return valid JSON matching the provided schema.

For each selected item:
- Keep summary under 35 words.
- Preserve the original URL exactly.
- Mention uncertainty if the description is vague.
- Do not invent source names.

Input date: {{date}}
Items:
{{items_json}}
```

Expected JSON shape:

```json
{
  "title": "Daily Digest: YYYY-MM-DD",
  "executiveSummary": "string",
  "sections": [
    {
      "heading": "string",
      "bullets": [
        {
          "title": "string",
          "summary": "string",
          "url": "string",
          "source": "string"
        }
      ]
    }
  ],
  "moreLinks": [
    {
      "title": "string",
      "url": "string",
      "source": "string"
    }
  ]
}
```

## 10. Frontend Pages and Components

Use React + Vite for the MVP. This keeps the app lightweight and leaves a clean path to Tauri if it becomes a desktop app.

Pages:

- `/digests`: list generated daily digests.
- `/digests/:date`: render one Markdown digest.
- `/feeds`: add, edit, enable, disable, and delete feeds.
- `/settings`: view non-secret app configuration and trigger a manual generation if enabled.

Components:

- `AppShell`: navigation and responsive layout.
- `DigestList`: date list with item counts and generation status.
- `DigestViewer`: loads Markdown for a selected date.
- `MarkdownRenderer`: sanitized Markdown rendering.
- `DatePicker`: navigate by day.
- `FeedList`: feed table/list.
- `FeedForm`: add or edit feed URL/title/category.
- `RunStatusBadge`: show succeeded, partial, failed, or running.
- `ErrorNotice`: consistent error display.
- `EmptyState`: first-run and no-digest states.

Frontend API modules:

- `supabaseClient.ts`
- `digestsApi.ts`
- `feedsApi.ts`
- `runsApi.ts`

The frontend should not know how Storage paths are signed or fetched. It only asks for a date and receives Markdown.

## 11. Error Handling and Logging

The system should degrade gracefully:

- Feed fetch failures are isolated to that feed.
- Partial digests are allowed when at least one feed succeeds.
- A total feed failure prevents AI generation and marks the run failed.
- AI failure produces a fallback digest containing grouped links without AI summaries.
- Invalid AI JSON triggers one repair/retry attempt.
- Storage failure fails the run because the durable artifact was not saved.

Log events:

- `digest_run_started`
- `feed_fetch_started`
- `feed_fetch_succeeded`
- `feed_fetch_failed`
- `rss_items_inserted`
- `digest_candidates_selected`
- `ai_summary_started`
- `ai_summary_succeeded`
- `ai_summary_failed`
- `markdown_rendered`
- `storage_upload_succeeded`
- `storage_upload_failed`
- `digest_run_finished`

Each log should include structured context such as `run_id`, `feed_id`, `digest_date`, and error details where relevant.

## 12. Security and RLS Strategy

This is a single-user private app, so security should be simple but strict.

Authentication:

- Require Supabase Auth for frontend access.
- The first implementation can allow exactly one configured owner email.
- Edge Functions that mutate data use service-role credentials server-side only.

RLS:

- Enable RLS on `feeds`, `daily_digests`, `digest_runs`, and `app_logs`.
- `feeds` rows are readable and writable only by `owner_id = auth.uid()`.
- `daily_digests` and `digest_runs` can be read only by the configured owner. Since these rows are not naturally per-feed owner records, implement this with a small `is_owner()` SQL helper that checks `auth.uid()` or the configured owner email.
- `rss_items` should not need direct frontend access in the MVP.
- `app_logs` can be hidden from the frontend initially or exposed read-only to the owner.

Secrets:

- Store `GEMINI_API_KEY`, `CRON_SECRET`, and any future provider keys as Supabase secrets.
- Do not store provider keys in Postgres.
- Do not expose service-role keys to the browser.

Storage:

- Keep `digests` bucket private.
- Let `get-digest` perform authenticated reads.
- Do not create public bucket policies for Markdown files in the MVP.

Cron:

- Cron invokes `generate-daily-digest` with a bearer secret.
- The function rejects requests without the expected secret unless manually invoked by the owner.

## 13. Implementation Roadmap

### Phase 1: Project foundation

- Initialize React + Vite frontend.
- Add Supabase config.
- Add Supabase CLI project structure.
- Create database migrations.
- Create private `digests` bucket setup instructions.
- Add environment example files.

### Phase 2: Shared backend modules

- Build RSS parsing utilities.
- Build HTML description cleanup.
- Build URL normalization and content hashing.
- Build Markdown rendering.
- Build AI provider types and Gemini provider.

### Phase 3: Edge Functions

- Implement `generate-daily-digest`.
- Implement `get-digest`.
- Add structured logs.
- Add manual run support.

### Phase 4: Cron

- Add SQL migration or setup script for daily scheduled invocation.
- Use `APP_TIMEZONE=Asia/Saigon`.
- Default schedule: once daily in the morning local time.

### Phase 5: Frontend MVP

- Implement digest list.
- Implement digest viewer.
- Implement feed management.
- Implement basic settings/run status.
- Add Markdown sanitization.

### Phase 6: Verification

- Unit test parsing, dedupe, prompt input shaping, and Markdown rendering.
- Test Edge Function locally with sample RSS XML.
- Test a no-items day.
- Test one failed feed plus one successful feed.
- Test malformed AI JSON fallback.
- Test private digest rendering through `get-digest`.

### Phase 7: Hardening and polish

- Add run history view.
- Add better empty states.
- Add import/export for feed list.
- Add provider configuration stubs for OpenAI, Claude, and Ollama.

## 14. Technical Risks and Mitigations

### RSS feeds are inconsistent

Feeds may be malformed, missing dates, missing descriptions, or served slowly.

Mitigation:

- Use tolerant parsing.
- Treat title and link as the minimum viable item.
- Isolate feed failures.
- Store `last_error` on each feed.

### AI output may be invalid or too verbose

The provider may return invalid JSON, omit fields, or over-summarize.

Mitigation:

- Request structured JSON.
- Validate response shape.
- Retry once with a repair instruction.
- Render Markdown locally.
- Fall back to a non-AI link digest.

### Token usage may creep upward

More feeds and longer descriptions can increase cost.

Mitigation:

- Enforce hard item caps.
- Enforce description length caps.
- Avoid full article fetching.
- Track token usage per run.
- Make caps configurable.

### Cron invocation can silently fail

Scheduled jobs can fail due to secrets, function deployment issues, or network problems.

Mitigation:

- Record every run in `digest_runs`.
- Add logs for invocation start and finish.
- Show latest run status in the frontend.
- Keep a manual trigger for owner testing.

### Storage access can become confusing

Direct signed URLs add expiry and permission complexity.

Mitigation:

- Keep the bucket private.
- Use `get-digest` as the only frontend Markdown read path.

### Desktop app may arrive later

A future desktop wrapper should not require backend rewrites.

Mitigation:

- Keep frontend data access behind small API modules.
- Store durable digest files as Markdown.
- Avoid browser-only coupling outside the React shell.

## Design Decision Summary

- Single-user/private MVP.
- Supabase owns backend, metadata, Storage, scheduled jobs, and server-side secrets.
- One scheduled Edge Function handles fetch and generation first.
- Gemini is the first provider, hidden behind `AiProvider`.
- RSS title and description are enough for MVP.
- AI returns structured summary JSON; local code renders Markdown.
- Frontend renders existing Markdown digests and manages feeds.
- Private Storage plus `get-digest` keeps access control simple.
