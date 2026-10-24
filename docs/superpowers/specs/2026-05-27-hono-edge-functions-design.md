# Hono Edge Functions Design

## Context

This project has two Supabase Edge Functions under `supabase/functions`:

- `get-digest`: digest reader using `Deno.serve(handleGetDigest)`; it will become public.
- `generate-daily-digest`: cron/manual digest generator using `Deno.serve(handleGenerateDailyDigest)`.

`get-digest` currently uses a plain request handler. The goal is to use Hono for the public digest read API while keeping digest generation as a separate plain scheduled/background function.

## Goals

- Introduce Hono for the public digest read Edge Function.
- Keep `generate-daily-digest` deployed as a separate scheduled function.
- Make digest reads public for now.
- Preserve response shapes where practical.
- Keep business logic easy to test outside the Supabase runtime.
- Avoid broad refactors unrelated to Hono adoption.

## Non-Goals

- Do not merge scheduled digest generation into the public read API.
- Do not change database schema, storage paths, or frontend API behavior.
- Do not redesign cron secret handling beyond keeping generation unauthenticated for now.
- Do not introduce a full API gateway unless a future feature needs it.

## Recommended Approach

Use a public Hono read route for digest retrieval. Keep the scheduled generation function as a plain `Deno.serve(handleGenerateDailyDigest)` handler because it is a cron job and does not benefit from routing.

The generation function remains separate because it is a background job with service role access, AI provider access, lock handling, and cron scheduling. The public digest read endpoint stays in `get-digest` with Hono without changing its function URL.

This keeps migration small, avoids mixing public reads with scheduled writes, and leaves room for a broader `api` function later.

## Function Design

### `get-digest`

- Create a Hono app in `supabase/functions/get-digest/index.ts`.
- Add `GET /` route.
- Route calls existing digest read flow:
  - Load config.
  - Validate `date=YYYY-MM-DD` query param.
  - Read digest metadata via service role client.
  - Download markdown from storage.
  - Return markdown with `Content-Type: text/markdown; charset=utf-8` and private cache header.
- Keep JSON error response format as `{ "error": string }`.
- Do not require `Authorization`.
- Do not call `auth.getUser()`.
- Set `verify_jwt = false` for `get-digest` in `supabase/config.toml` so Supabase does not reject unauthenticated public requests before Hono handles them.

### `generate-daily-digest`

- Keep `supabase/functions/generate-daily-digest/index.ts` on plain `Deno.serve(handleGenerateDailyDigest)`.
- Preserve current body/query behavior, logging, lock handling, and response shape.
- Keep `verify_jwt = false` in `supabase/config.toml` for this function.
- Keep generation unauthenticated for now so scheduled calls work without bearer tokens.
- Schedule this function to run every 3 hours by default, with the cron expression customizable through the existing migration/config path.

## Dependencies

Add Hono to `supabase/functions/deno.json` imports. Prefer a Deno-compatible import alias such as:

```json
"hono": "jsr:@hono/hono"
```

Use import form:

```ts
import { Hono } from "hono";
```

Use the JSR import alias first. If local Deno tooling rejects JSR imports during verification, switch to a pinned Hono URL import in the implementation plan.

## Error Handling

- Preserve existing status codes and JSON bodies where behavior is still applicable.
- `get-digest` no longer returns `401` for missing/invalid authorization because it is public.
- Do not add global exception rewriting unless it preserves current behavior.
- Let existing `generate-daily-digest` catch block continue marking failed runs and releasing locks.

## Testing

- Update existing tests only where handler entrypoints change.
- Run `deno test` from `supabase/functions` using existing Deno task.
- Run frontend tests only if shared frontend-facing behavior changes; expected not needed for this refactor.

## Rollout

- Migrate `get-digest` first because it is small and request/response behavior is easy to verify.
- Migrate `generate-daily-digest` second, keeping business logic untouched as much as possible.
- Verify all Deno function tests pass.

## Decisions

- Export `app` from each function file.
- Preserve current named request handler exports by making them call `app.fetch(request)`.
- Start with `jsr:@hono/hono` in `deno.json`; use a pinned URL only if verification shows this repo cannot use JSR imports.
- Keep `generate-daily-digest` separate from public digest reads.
- Make `get-digest` public for now.
