# KISS Hono API And RSS Cron Design

## Context

This project already has Supabase Edge Functions for digest reads and digest generation:

- `get-digest` is a small Hono endpoint that returns stored digest markdown.
- `generate-daily-digest` is a large scheduled handler that fetches RSS feeds, stores items, builds summaries, writes digest markdown, and updates run status.
- `supabase/migrations/202605190003_cron.sql` currently schedules `generate-daily-digest` every 3 hours through `pg_cron` and `pg_net`.

The desired direction is KISS: Hono should be the backend API, while RSS cron work should move into a script/job path instead of living as one large HTTP handler.

## Goals

- Keep Hono focused on API routes.
- Move RSS cron orchestration into a standalone script entrypoint.
- Extract digest generation into shared job code that can be called by script or API.
- Keep behavior stable: same tables, storage bucket, digest markdown format, and run status model.
- Make future changes easier by separating HTTP routing from background work.

## Non-Goals

- Do not redesign database schema.
- Do not change frontend screens or visual behavior.
- Do not add a queue system.
- Do not add new auth roles unless needed by an API route.
- Do not rewrite RSS parsing, AI prompts, or markdown rendering unless extraction requires tiny glue changes.

## Recommended Approach

Use one Hono API function for request/response routes and one standalone Deno cron script for RSS digest generation. Both call shared service/job code where useful.

This keeps each entrypoint small:

- API handles HTTP concerns: route params, response shape, status codes.
- Cron script handles command concerns: date input, logging to console, process exit.
- Shared job handles business behavior: fetch RSS, store items, summarize, upload markdown, update run status.

## File Structure

- `supabase/functions/api/index.ts`: Hono app for backend API routes.
- `supabase/functions/_shared/digestJob.ts`: extracted digest generation workflow.
- `supabase/functions/scripts/cron-rss-digest.ts`: standalone cron script that calls `runDigestJob`.
- `supabase/functions/get-digest/index.ts`: either removed after frontend migration or kept as compatibility wrapper during rollout.
- `supabase/functions/generate-daily-digest/index.ts`: either removed after cron migration or reduced to compatibility wrapper during rollout.
- `src/api/digestsApi.ts`: point frontend digest markdown requests to Hono API route if route path changes.
- `docs/setup.md`: document script-based cron path and remove stale cron-secret instructions.

## API Design

The Hono API should start small:

- `GET /digests/:date/markdown`
  - Public for now, matching current `get-digest` behavior.
  - Validates `date` as `YYYY-MM-DD`.
  - Reads latest digest row for date.
  - Downloads markdown from storage.
  - Returns `text/markdown; charset=utf-8`.

Optional later route:

- `POST /digest-runs`
  - Manual generation route for admins or local testing.
  - Calls the same `runDigestJob` as cron script.
  - Not required for first KISS refactor if cron script is enough.

## Cron Script Design

Create `supabase/functions/scripts/cron-rss-digest.ts` as a thin Deno script.

Inputs:

- Optional `--date YYYY-MM-DD` argument.
- If no date is provided, use current date in configured timezone.

Behavior:

- Load config through existing `getConfig`.
- Create Supabase service role client.
- Call `runDigestJob({ date, config, supabase })`.
- Log result to stdout.
- Exit non-zero if job fails before writing a failed run status.

This script is suitable for local OS cron, GitHub Actions schedules, or any external scheduler that can run Deno. Hosted Supabase `pg_cron` cannot directly run this script, so hosted-only deployments can keep a thin Edge Function wrapper temporarily.

## Shared Job Design

Extract the current `handleGenerateDailyDigest` body into a shared function:

```ts
export async function runDigestJob(input: {
  date?: string;
  config: AppConfig;
  supabase: DigestSupabaseClient;
}): Promise<{ runId: string; date: string; status: "succeeded" | "partial" }>;
```

Keep helper functions near this job if they are only used by digest generation:

- date validation and local day bounds
- owner lookup
- feed fetch with timeout and byte cap
- candidate selection
- fallback digest
- URL sanitization
- lock cleanup

Do not split into many tiny files during first refactor. One shared job module is enough and follows KISS better than a wide service layer.

## Rollout

1. Extract `runDigestJob` from `generate-daily-digest` without changing behavior.
2. Add `cron-rss-digest.ts` script and tests for date/input behavior where practical.
3. Add `api` Hono function with digest markdown route.
4. Point frontend to new API route.
5. Keep old functions as wrappers for one migration step if needed.
6. Update docs and cron guidance.
7. Remove old wrappers only after verification that new API/script paths work.

## Error Handling

- API route returns JSON errors as `{ "error": string }` for validation, missing digest, and storage failures.
- Cron script logs errors and lets `runDigestJob` update `digest_runs` where a run exists.
- Lock cleanup behavior stays unchanged.
- RSS feed failures remain per-feed warnings and can produce `partial` runs.

## Testing

- Keep existing helper tests for RSS, URLs, config, markdown, and AI provider code.
- Add/adjust Hono API tests for public markdown route.
- Add job-level tests only around extracted pure helpers and dependency boundaries.
- Run Deno tests from `supabase/functions`.
- Run frontend tests only if `src/api/digestsApi.ts` behavior changes.

## Deployment Notes

- For external cron, run the script with Deno permissions needed for env, network, and imports.
- For hosted Supabase-only cron, keep a thin `generate-daily-digest` Edge Function wrapper that calls `runDigestJob`, and let `pg_cron` continue HTTP invocation.
- Do not keep cron secret documentation if `verify_jwt = false` and no secret header is checked.

## Decisions

- Use split fetch script direction.
- Use Hono as backend API, not as cron orchestration layer.
- Keep first refactor behavior-preserving.
- Prefer one shared `digestJob.ts` over many small service files.
- Keep compatibility wrappers temporarily if needed for Supabase-hosted cron.
