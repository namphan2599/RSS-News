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
npx supabase secrets set GEMINI_MODEL=gemini-2.0-flash
npx supabase secrets set GEMINI_API_KEY=AIzaSyAGVDhN6a7T4KKC1nYHAqUj02GtszH0N5o
npx supabase secrets set CRON_SECRET=generate-a-long-random-string
npx supabase secrets set DIGEST_MAX_ITEMS=60
npx supabase secrets set DIGEST_MAX_ITEMS_PER_FEED=8
npx supabase secrets set DIGEST_DESCRIPTION_MAX_CHARS=500
npx supabase secrets set DIGEST_MAX_OUTPUT_TOKENS=2500
```

For hosted Supabase Cron SQL settings, configure:

```sql
alter database postgres set app.owner_email = 'you@example.com';
alter database postgres set app.supabase_url = 'https://your-project-ref.supabase.co';
alter database postgres set app.cron_secret = 'generate-a-long-random-string';
```

On hosted Supabase, production cron secrets may be better stored through Supabase Vault where available. The database settings above remain compatible with plans where Vault-backed cron configuration is not available.

Apply migrations:

```bash
supabase db push
```

## Manual MVP Verification

1. Sign in as the configured owner email.
2. Add one RSS feed on `/feeds`.
3. Invoke `generate-daily-digest` with the cron secret.
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
curl -X POST "https://idmftrpbubhelkhnbkwa.supabase.co/functions/v1/generate-daily-digest" ^
  -H "x-cron-secret: generate-a-long-random-string" ^
  -H "Content-Type: application/json" ^
  -d "{\"date\":\"2026-05-26\"}"