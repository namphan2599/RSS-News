# RSS Digest Setup

## Local prerequisites

- Node.js 20 or newer
- Supabase CLI
- A Supabase project
- A Gemini API key

## Environment

Copy `.env.example` to `.env.local` for frontend development.

Set function secrets:

```bash
supabase secrets set APP_OWNER_EMAIL=you@example.com
supabase secrets set APP_TIMEZONE=Asia/Saigon
supabase secrets set AI_PROVIDER=gemini
supabase secrets set GEMINI_MODEL=gemini-2.0-flash
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set CRON_SECRET=generate-a-long-random-string
supabase secrets set DIGEST_MAX_ITEMS=60
supabase secrets set DIGEST_MAX_ITEMS_PER_FEED=8
supabase secrets set DIGEST_DESCRIPTION_MAX_CHARS=500
supabase secrets set DIGEST_MAX_OUTPUT_TOKENS=2500
```

For hosted Supabase Cron SQL settings, configure:

```sql
alter database postgres set app.owner_email = 'you@example.com';
alter database postgres set app.supabase_url = 'https://your-project-ref.supabase.co';
alter database postgres set app.cron_secret = 'generate-a-long-random-string';
```

Apply migrations:

```bash
supabase db push
```
