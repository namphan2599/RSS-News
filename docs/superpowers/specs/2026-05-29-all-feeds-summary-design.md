# All Feeds Summary Design

## Goal

Generate one daily digest from all active feeds owned by the configured owner. Store the generated text directly in `daily_digests.summary` instead of writing markdown files to Supabase Storage.

## Database

Add a migration that makes `daily_digests.storage_bucket` and `daily_digests.storage_path` nullable. Existing digest rows keep their current storage values. New digest rows may leave both fields null.

No new tables are needed. The existing `feeds.category` column is the primary source for digest topics.

## Edge Function

Update the existing `rss-summary` Edge Function to run across all active owner feeds instead of requiring a single `url` query parameter.

The function will:

- Read `OWNER_USER_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and optional `GEMINI_MODEL`.
- Query active feeds for `OWNER_USER_ID` from `public.feeds`.
- Fetch each feed URL and parse RSS or Atom items (skip if unavailable or accessible).
- Attach source metadata to each item: feed id, feed title, feed URL, and feed category.
- Use `feeds.category` as the topic/category when present.
- Ask Gemini to infer a concise topic only for items whose feed has no category.
- Ask Gemini for one grouped daily summary organized by topic/category, such as `Tech`, `Programming`, `Games`, or `Food`.
- Insert one `digest_runs` row with feed counts, failed feed counts, item counts, selected item counts, model metadata, and failure details in `metadata`.
- Upsert one `daily_digests` row for the day with `summary`, title, item count, run id, and null storage fields.

The function will not upload markdown to Supabase Storage for new digests.

## Failure Handling

Feed failures should not stop the whole run if at least one feed yields items. Failed feeds update `feeds.last_error`; successful fetches update `feeds.last_fetched_at` and clear `last_error`.

Run status behavior:

- `succeeded`: all fetched feeds succeed and a digest is saved.
- `partial`: at least one feed fails, but enough items exist to save a digest.
- `failed`: no active feeds exist, all feeds fail, no items are parsed, Gemini fails, or saving fails.

The HTTP response should include the run id, digest id when saved, status, feed counts, item count, and summary when generated.

## Frontend

Replace markdown-based digest detail loading with direct `daily_digests.summary` loading.

The digest list can keep showing existing summary snippets. The digest detail page should show the digest title, date, and summary text. No storage URL lookup or markdown file fetch is needed for new digests.

Existing markdown-only historical rows are not migrated. If a historical row has no `summary`, the detail page should show an empty-state style message that no summary is available.

## Testing

Update Edge Function tests to cover:

- Fetching all active feeds from Supabase.
- Grouped summary prompt includes feed categories and uncategorized item context.
- Partial feed failure still saves a digest.
- No Supabase Storage upload occurs.
- `daily_digests` upsert stores summary and null storage fields.

Update frontend tests to cover:

- Digest detail reads summary from `daily_digests`.
- Digest detail does not fetch storage markdown.
- Missing summary displays a clear empty state.

## Out Of Scope

- Deleting old storage objects.
- Migrating old markdown content into `daily_digests.summary`.
- Adding a new topic taxonomy table.
- Adding per-topic digest rows.
