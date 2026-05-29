# RSS Digest Setup

## Local prerequisites

- Node.js 20 or newer
- Supabase CLI
- Docker Desktop for local database verification
- A Supabase project
- A Gemini API key

## Environment

Copy `.env.example` to `.env.local` for frontend development.

Set function secrets:

```bash
npx supabase secrets set APP_OWNER_EMAIL=anomynous992@gmail.com
npx supabase secrets set APP_TIMEZONE=Asia/Saigon
npx supabase secrets set AI_PROVIDER=gemini
npx supabase secrets set GEMINI_MODEL=gemma-4-26b-a4b-it
npx supabase secrets set GEMINI_API_KEY=your-gemini-api-key
npx supabase secrets set DIGEST_MAX_ITEMS=60
npx supabase secrets set DIGEST_MAX_ITEMS_PER_FEED=8
npx supabase secrets set DIGEST_DESCRIPTION_MAX_CHARS=500
npx supabase secrets set DIGEST_MAX_OUTPUT_TOKENS=2500
```
For hosted Supabase Cron SQL settings, configure the project URL used by `pg_net`:

```sql
alter database postgres set app.supabase_url = 'https://your-project-ref.supabase.co';
```

The scheduled Edge Function no longer checks `CRON_SECRET`; `supabase/config.toml` disables JWT verification for the cron wrapper.

Apply migrations:

```bash
supabase db push
```

## Manual MVP Verification

1. Sign in as the configured owner email.
2. Add one RSS feed on `/feeds`.
3. Run the cron script.
4. Confirm `digest_runs` contains a succeeded or partial run.
5. Confirm `daily_digests` contains one row for the target date.
6. Confirm Storage bucket `digests` contains `daily/YYYY/MM/YYYY-MM-DD.md`.
7. Open `/digests`.
8. Open the generated date and confirm Markdown renders.
9. Disable the feed and confirm it no longer participates in future runs.

For local verification, start and reset the local Supabase database:

```bash
supabase db start
supabase db reset
```
Run the script-based cron path from `supabase/functions`:

```bash
deno run --allow-env --allow-net=deno.land,esm.sh,jsr.io,your-project-ref.supabase.co scripts/cron-rss-digest.ts --date 2026-05-26
```

For external cron, schedule the same command without `--date` so the script uses the configured timezone's current date.
