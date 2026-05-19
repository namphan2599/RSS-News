# RSS Digest App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private single-user RSS digest web app that fetches RSS feeds, summarizes daily items with Gemini, stores one Markdown file per day in Supabase Storage, and renders those Markdown digests in the frontend.

**Architecture:** React + Vite renders the authenticated web UI and calls Supabase. Supabase Postgres stores feed, item, run, and digest metadata; private Supabase Storage stores Markdown; Edge Functions fetch RSS, call AI through a provider abstraction, write Markdown, and return private digest files. Cron invokes the daily generation function with a secret.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Router, Supabase JS, Supabase Edge Functions, Supabase Postgres, Supabase Storage, Supabase Cron, Gemini API, `fast-xml-parser`, `zod`, `react-markdown`, `remark-gfm`, `rehype-sanitize`, `lucide-react`.

---

## File Structure

Create this structure:

```text
.
  .env.example
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  index.html
  src/
    App.tsx
    main.tsx
    styles.css
    lib/
      env.ts
      supabaseClient.ts
    api/
      digestsApi.ts
      feedsApi.ts
      runsApi.ts
    components/
      AppShell.tsx
      DatePicker.tsx
      DigestList.tsx
      DigestViewer.tsx
      EmptyState.tsx
      ErrorNotice.tsx
      FeedForm.tsx
      FeedList.tsx
      MarkdownRenderer.tsx
      RunStatusBadge.tsx
    pages/
      DigestsPage.tsx
      DigestDetailPage.tsx
      FeedsPage.tsx
      SettingsPage.tsx
    test/
      setup.ts
  supabase/
    config.toml
    migrations/
      202605190001_initial_schema.sql
      202605190002_storage_bucket.sql
      202605190003_cron.sql
    functions/
      deno.json
      _shared/
        ai/
          providerFactory.ts
          prompt.ts
          types.ts
          providers/
            gemini.ts
        config.ts
        dates.ts
        digestMarkdown.ts
        digestMarkdown.test.ts
        html.ts
        html.test.ts
        logging.ts
        rss.ts
        rss.test.ts
        urls.ts
        urls.test.ts
      generate-daily-digest/
        index.ts
      get-digest/
        index.ts
  docs/
    setup.md
```

Responsibility boundaries:

- `src/api/*` hides Supabase calls from React pages.
- `src/components/*` are small UI components without direct database logic.
- `supabase/functions/_shared/*` contains runtime-neutral logic used by functions and tests.
- `generate-daily-digest/index.ts` coordinates the pipeline only; parsing, prompting, Markdown, dates, logging, and provider code live in shared modules.
- `get-digest/index.ts` is the only frontend path for private Markdown file reads.

## Task 1: Scaffold Web App and Tooling

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `.env.example`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Initialize package manifest**

Create `package.json`:

```json
{
  "name": "rss-digest-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.1",
    "react-router-dom": "^6.26.0",
    "rehype-sanitize": "^6.0.0",
    "remark-gfm": "^4.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "eslint": "^9.9.0",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.9",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules` and `package-lock.json` are created, and the command exits with code 0.

- [ ] **Step 3: Add Vite and TypeScript config**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RSS Digest</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true
  }
});
```

- [ ] **Step 4: Add environment example**

Create `.env.example`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Supabase function secrets, set with `supabase secrets set`.
APP_OWNER_EMAIL=you@example.com
APP_TIMEZONE=Asia/Saigon
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your-gemini-key
CRON_SECRET=generate-a-long-random-string
DIGEST_MAX_ITEMS=60
DIGEST_MAX_ITEMS_PER_FEED=8
DIGEST_DESCRIPTION_MAX_CHARS=500
DIGEST_MAX_OUTPUT_TOKENS=2500
```

- [ ] **Step 5: Add minimal React entry**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/digests" replace />} />
      <Route path="/digests" element={<main>Digests</main>} />
      <Route path="/digests/:date" element={<main>Digest detail</main>} />
      <Route path="/feeds" element={<main>Feeds</main>} />
      <Route path="/settings" element={<main>Settings</main>} />
    </Routes>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #17201a;
  background: #f7f4ed;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

a {
  color: inherit;
}

button,
input {
  font: inherit;
}
```

- [ ] **Step 6: Verify scaffold**

Run:

```bash
npm run build
```

Expected: TypeScript succeeds and Vite writes `dist`.

- [ ] **Step 7: Commit**

Run:

```bash
git add .env.example package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src
git commit -m "chore: scaffold rss digest frontend"
```

Expected: commit succeeds.

## Task 2: Add Supabase Schema, Storage, and Cron Migrations

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202605190001_initial_schema.sql`
- Create: `supabase/migrations/202605190002_storage_bucket.sql`
- Create: `supabase/migrations/202605190003_cron.sql`
- Create: `docs/setup.md`

- [ ] **Step 1: Create Supabase config**

Create `supabase/config.toml`:

```toml
project_id = "rss-digest-app"

[api]
enabled = true
port = 54321
schemas = ["public", "storage"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
major_version = 15

[studio]
enabled = true
port = 54323

[auth]
enabled = true
site_url = "http://127.0.0.1:5173"
additional_redirect_urls = ["http://127.0.0.1:5173"]
jwt_expiry = 3600
enable_signup = false
```

- [ ] **Step 2: Create initial schema migration**

Create `supabase/migrations/202605190001_initial_schema.sql`:

```sql
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = coalesce(current_setting('app.owner_email', true), '');
$$;

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

create trigger feeds_set_updated_at
before update on public.feeds
for each row execute function public.set_updated_at();

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
create index rss_items_feed_id_idx on public.rss_items (feed_id);

create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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
create index digest_runs_owner_id_idx on public.digest_runs (owner_id);

create table public.daily_digests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  digest_date date not null,
  storage_bucket text not null default 'digests',
  storage_path text not null,
  title text not null,
  summary text,
  item_count int not null default 0,
  run_id uuid references public.digest_runs(id),
  generated_at timestamptz not null default now(),
  unique (owner_id, digest_date)
);

create index daily_digests_digest_date_idx on public.daily_digests (digest_date desc);
create index daily_digests_owner_id_idx on public.daily_digests (owner_id);

create table public.app_logs (
  id bigint generated always as identity primary key,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index app_logs_created_at_idx on public.app_logs (created_at desc);

create table public.digest_locks (
  digest_date date primary key,
  run_id uuid not null references public.digest_runs(id) on delete cascade,
  acquired_at timestamptz not null default now()
);

alter table public.feeds enable row level security;
alter table public.rss_items enable row level security;
alter table public.digest_runs enable row level security;
alter table public.daily_digests enable row level security;
alter table public.app_logs enable row level security;
alter table public.digest_locks enable row level security;

create policy "owner reads feeds"
on public.feeds for select
to authenticated
using (owner_id = auth.uid());

create policy "owner inserts feeds"
on public.feeds for insert
to authenticated
with check (owner_id = auth.uid() and public.is_owner());

create policy "owner updates feeds"
on public.feeds for update
to authenticated
using (owner_id = auth.uid() and public.is_owner())
with check (owner_id = auth.uid() and public.is_owner());

create policy "owner deletes feeds"
on public.feeds for delete
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create policy "owner reads rss items through owned feeds"
on public.rss_items for select
to authenticated
using (
  exists (
    select 1
    from public.feeds
    where feeds.id = rss_items.feed_id
      and feeds.owner_id = auth.uid()
  )
);

create policy "owner reads digest runs"
on public.digest_runs for select
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create policy "owner reads daily digests"
on public.daily_digests for select
to authenticated
using (owner_id = auth.uid() and public.is_owner());

create policy "owner reads app logs"
on public.app_logs for select
to authenticated
using (public.is_owner());

create policy "owner reads digest locks"
on public.digest_locks for select
to authenticated
using (public.is_owner());
```

- [ ] **Step 3: Create Storage bucket migration**

Create `supabase/migrations/202605190002_storage_bucket.sql`:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digests', 'digests', false, 1048576, array['text/markdown', 'text/plain'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
```

- [ ] **Step 4: Create Cron migration**

Create `supabase/migrations/202605190003_cron.sql`:

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'generate-daily-rss-digest',
  '0 0 * * *',
  $$
  select
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-daily-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret')
      ),
      body := jsonb_build_object('source', 'cron')
    );
  $$
);
```

This schedules 00:00 UTC, which is 07:00 Asia/Saigon.

- [ ] **Step 5: Add setup notes**

Create `docs/setup.md`:

```md
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
```

- [ ] **Step 6: Verify migration syntax locally**

Run:

```bash
supabase db start
supabase db reset
```

Expected: all three migrations apply without SQL errors.

- [ ] **Step 7: Commit**

Run:

```bash
git add supabase/config.toml supabase/migrations docs/setup.md
git commit -m "feat: add supabase schema and scheduling"
```

Expected: commit succeeds.

## Task 3: Add Shared Edge Function Utilities with Tests

**Files:**
- Create: `supabase/functions/deno.json`
- Create: `supabase/functions/_shared/html.ts`
- Create: `supabase/functions/_shared/html.test.ts`
- Create: `supabase/functions/_shared/urls.ts`
- Create: `supabase/functions/_shared/urls.test.ts`
- Create: `supabase/functions/_shared/dates.ts`
- Create: `supabase/functions/_shared/rss.ts`
- Create: `supabase/functions/_shared/rss.test.ts`

- [ ] **Step 1: Add Deno test config**

Create `supabase/functions/deno.json`:

```json
{
  "tasks": {
    "test": "deno test --allow-env --allow-net=deno.land,esm.sh"
  },
  "imports": {
    "fast-xml-parser": "npm:fast-xml-parser@4.4.1"
  },
  "compilerOptions": {
    "strict": true
  }
}
```

- [ ] **Step 2: Write failing HTML cleanup tests**

Create `supabase/functions/_shared/html.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cleanDescription } from "./html.ts";

Deno.test("cleanDescription strips tags and decodes common entities", () => {
  const result = cleanDescription("<p>Hello&nbsp;<strong>world</strong> &amp; news</p>", 80);
  assertEquals(result, "Hello world & news");
});

Deno.test("cleanDescription truncates without splitting words when possible", () => {
  const result = cleanDescription("Alpha beta gamma delta", 12);
  assertEquals(result, "Alpha beta...");
});
```

- [ ] **Step 3: Run HTML tests to verify failure**

Run:

```bash
deno test --allow-env supabase/functions/_shared/html.test.ts
```

Expected: FAIL because `html.ts` does not exist.

- [ ] **Step 4: Implement HTML cleanup**

Create `supabase/functions/_shared/html.ts`:

```ts
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " "
};

export function cleanDescription(input: string | null | undefined, maxChars: number): string {
  const raw = input ?? "";
  const withoutScripts = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]*>/g, " ");
  const decoded = Object.entries(ENTITIES).reduce(
    (text, [entity, value]) => text.replaceAll(entity, value),
    withoutTags
  );
  const normalized = decoded.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const slice = normalized.slice(0, Math.max(0, maxChars - 3));
  const lastSpace = slice.lastIndexOf(" ");
  const shortened = lastSpace >= 8 ? slice.slice(0, lastSpace) : slice;
  return `${shortened.trim()}...`;
}
```

- [ ] **Step 5: Verify HTML tests pass**

Run:

```bash
deno test --allow-env supabase/functions/_shared/html.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write failing URL tests**

Create `supabase/functions/_shared/urls.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildContentHash, normalizeUrl } from "./urls.ts";

Deno.test("normalizeUrl removes tracking params and hash", () => {
  const result = normalizeUrl("https://example.com/story?utm_source=x&id=42#section");
  assertEquals(result, "https://example.com/story?id=42");
});

Deno.test("buildContentHash is stable for same inputs", async () => {
  const first = await buildContentHash({
    feedId: "feed-1",
    guid: "guid-1",
    url: "https://example.com/a",
    title: "A story",
    publishedAt: "2026-05-19T00:00:00Z"
  });
  const second = await buildContentHash({
    feedId: "feed-1",
    guid: "guid-1",
    url: "https://example.com/a",
    title: "A story",
    publishedAt: "2026-05-19T00:00:00Z"
  });
  assertEquals(first, second);
  assertEquals(first.length, 64);
});
```

- [ ] **Step 7: Implement URL utilities**

Create `supabase/functions/_shared/urls.ts`:

```ts
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid"
]);

export function normalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = "";
    for (const param of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMS.has(param.toLowerCase())) {
        url.searchParams.delete(param);
      }
    }
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "");
  } catch {
    return input.trim();
  }
}

export async function buildContentHash(input: {
  feedId: string;
  guid?: string | null;
  url: string;
  title: string;
  publishedAt?: string | null;
}): Promise<string> {
  const normalized = [
    input.feedId,
    input.guid?.trim() || normalizeUrl(input.url),
    input.title.trim().toLowerCase(),
    input.publishedAt ?? ""
  ].join("|");
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 8: Verify URL tests pass**

Run:

```bash
deno test --allow-env supabase/functions/_shared/urls.test.ts
```

Expected: PASS.

- [ ] **Step 9: Add date utility**

Create `supabase/functions/_shared/dates.ts`:

```ts
export function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function digestStoragePath(date: string): string {
  const [year, month] = date.split("-");
  return `daily/${year}/${month}/${date}.md`;
}
```

- [ ] **Step 10: Write failing RSS parser test**

Create `supabase/functions/_shared/rss.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseFeed } from "./rss.ts";

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <link>https://example.com</link>
    <item>
      <title>Story One</title>
      <link>https://example.com/story-one?utm_source=rss</link>
      <guid>story-one</guid>
      <description><![CDATA[<p>Short <b>description</b>.</p>]]></description>
      <pubDate>Tue, 19 May 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

Deno.test("parseFeed extracts RSS title and item fields", async () => {
  const parsed = await parseFeed(SAMPLE_RSS, "feed-1", "https://example.com/rss.xml", 500);
  assertEquals(parsed.feedTitle, "Example Feed");
  assertEquals(parsed.siteUrl, "https://example.com");
  assertEquals(parsed.items.length, 1);
  assertEquals(parsed.items[0].title, "Story One");
  assertEquals(parsed.items[0].description, "Short description.");
  assertEquals(parsed.items[0].normalizedUrl, "https://example.com/story-one");
  assertEquals(parsed.items[0].contentHash.length, 64);
});
```

- [ ] **Step 11: Implement RSS parser**

Create `supabase/functions/_shared/rss.ts`:

```ts
import { XMLParser } from "fast-xml-parser";
import { cleanDescription } from "./html.ts";
import { buildContentHash, normalizeUrl } from "./urls.ts";

export type ParsedFeedItem = {
  feedId: string;
  guid: string | null;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  publishedAt: string | null;
  contentHash: string;
};

export type ParsedFeed = {
  feedTitle: string | null;
  siteUrl: string | null;
  items: ParsedFeedItem[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  trimValues: true
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return text(record["#cdata"] ?? record["#text"] ?? "");
  }
  return "";
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function parseFeed(
  xml: string,
  feedId: string,
  feedUrl: string,
  descriptionMaxChars: number
): Promise<ParsedFeed> {
  const parsed = parser.parse(xml);
  const channel = parsed.rss?.channel;
  const atom = parsed.feed;
  const feedTitle = text(channel?.title ?? atom?.title) || null;
  const siteUrl = text(channel?.link ?? asArray(atom?.link)[0]?.["@_href"]) || null;
  const rawItems = channel ? asArray(channel.item) : asArray(atom?.entry);

  const items: ParsedFeedItem[] = [];
  for (const raw of rawItems) {
    const item = raw as Record<string, unknown>;
    const title = cleanDescription(text(item.title), 240);
    const linkValue = text(item.link) || text((item.link as Record<string, unknown> | undefined)?.["@_href"]);
    const url = linkValue || feedUrl;
    const guid = text(item.guid ?? item.id) || null;
    const description = cleanDescription(text(item.description ?? item.summary ?? item.content), descriptionMaxChars);
    const publishedAt = parseDate(text(item.pubDate ?? item.published ?? item.updated));

    if (!title || !url) {
      continue;
    }

    const normalizedUrl = normalizeUrl(url);
    const contentHash = await buildContentHash({ feedId, guid, url, title, publishedAt });
    items.push({ feedId, guid, url, normalizedUrl, title, description, publishedAt, contentHash });
  }

  return { feedTitle, siteUrl, items };
}
```

- [ ] **Step 12: Verify all shared tests pass**

Run:

```bash
deno test --allow-env supabase/functions/_shared
```

Expected: PASS for HTML, URL, and RSS tests.

- [ ] **Step 13: Commit**

Run:

```bash
git add supabase/functions
git commit -m "feat: add rss parsing utilities"
```

Expected: commit succeeds.

## Task 4: Add AI Provider, Prompt, Markdown, and Tests

**Files:**
- Create: `supabase/functions/_shared/ai/types.ts`
- Create: `supabase/functions/_shared/ai/prompt.ts`
- Create: `supabase/functions/_shared/ai/providerFactory.ts`
- Create: `supabase/functions/_shared/ai/providers/gemini.ts`
- Create: `supabase/functions/_shared/digestMarkdown.ts`
- Create: `supabase/functions/_shared/digestMarkdown.test.ts`
- Create: `supabase/functions/_shared/config.ts`

- [ ] **Step 1: Create AI types**

Create `supabase/functions/_shared/ai/types.ts`:

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

- [ ] **Step 2: Create prompt builder**

Create `supabase/functions/_shared/ai/prompt.ts`:

```ts
import type { DigestInputItem } from "./types.ts";

export function buildDigestPrompt(date: string, items: DigestInputItem[]): string {
  const compactItems = items.map((item) => ({
    id: item.id,
    s: item.feedTitle,
    t: item.title,
    u: item.url,
    d: item.description ?? "",
    p: item.publishedAt ?? ""
  }));

  return [
    "You create concise daily RSS digests.",
    "",
    "Use only the provided RSS title, description, source, date, and URL.",
    "Do not infer facts beyond the provided text.",
    "Group related stories into 3-6 useful sections.",
    "Prefer concise summaries over commentary.",
    "Deduplicate similar stories.",
    "Return valid JSON matching this shape:",
    '{"title":"Daily Digest: YYYY-MM-DD","executiveSummary":"string","sections":[{"heading":"string","bullets":[{"title":"string","summary":"string","url":"string","source":"string"}]}],"moreLinks":[{"title":"string","url":"string","source":"string"}]}',
    "",
    "For each selected item:",
    "- Keep summary under 35 words.",
    "- Preserve the original URL exactly.",
    "- Mention uncertainty if the description is vague.",
    "- Do not invent source names.",
    "",
    `Input date: ${date}`,
    `Items: ${JSON.stringify(compactItems)}`
  ].join("\n");
}
```

- [ ] **Step 3: Create function config reader**

Create `supabase/functions/_shared/config.ts`:

```ts
export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  ownerEmail: string;
  timezone: string;
  aiProvider: string;
  geminiModel: string;
  geminiApiKey: string;
  cronSecret: string;
  digestMaxItems: number;
  digestMaxItemsPerFeed: number;
  digestDescriptionMaxChars: number;
  digestMaxOutputTokens: number;
};

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const value = Deno.env.get(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric environment variable: ${name}`);
  return parsed;
}

export function getConfig(): AppConfig {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    ownerEmail: required("APP_OWNER_EMAIL"),
    timezone: Deno.env.get("APP_TIMEZONE") ?? "Asia/Saigon",
    aiProvider: Deno.env.get("AI_PROVIDER") ?? "gemini",
    geminiModel: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash",
    geminiApiKey: required("GEMINI_API_KEY"),
    cronSecret: required("CRON_SECRET"),
    digestMaxItems: numberEnv("DIGEST_MAX_ITEMS", 60),
    digestMaxItemsPerFeed: numberEnv("DIGEST_MAX_ITEMS_PER_FEED", 8),
    digestDescriptionMaxChars: numberEnv("DIGEST_DESCRIPTION_MAX_CHARS", 500),
    digestMaxOutputTokens: numberEnv("DIGEST_MAX_OUTPUT_TOKENS", 2500)
  };
}
```

- [ ] **Step 4: Create Gemini provider**

Create `supabase/functions/_shared/ai/providers/gemini.ts`:

```ts
import { buildDigestPrompt } from "../prompt.ts";
import type { AiProvider, DigestSummary } from "../types.ts";

function parseJson(text: string): DigestSummary {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(trimmed) as DigestSummary;
  if (!parsed.title || !parsed.executiveSummary || !Array.isArray(parsed.sections)) {
    throw new Error("Gemini response did not match digest schema");
  }
  return parsed;
}

export function createGeminiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: "gemini",
    model,
    async summarizeDailyDigest(input) {
      const prompt = buildDigestPrompt(input.date, input.items.slice(0, input.maxItems));
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: input.maxOutputTokens,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${body}`);
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") {
        throw new Error("Gemini response did not include text content");
      }

      return {
        digest: parseJson(text),
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount,
          outputTokens: json.usageMetadata?.candidatesTokenCount
        },
        raw: json
      };
    }
  };
}
```

- [ ] **Step 5: Create provider factory**

Create `supabase/functions/_shared/ai/providerFactory.ts`:

```ts
import type { AppConfig } from "../config.ts";
import type { AiProvider } from "./types.ts";
import { createGeminiProvider } from "./providers/gemini.ts";

export function createAiProvider(config: AppConfig): AiProvider {
  if (config.aiProvider === "gemini") {
    return createGeminiProvider(config.geminiApiKey, config.geminiModel);
  }
  throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
}
```

- [ ] **Step 6: Write failing Markdown renderer test**

Create `supabase/functions/_shared/digestMarkdown.test.ts`:

```ts
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { renderDigestMarkdown } from "./digestMarkdown.ts";

Deno.test("renderDigestMarkdown writes deterministic daily digest", () => {
  const markdown = renderDigestMarkdown({
    date: "2026-05-19",
    generatedAt: "2026-05-19 07:00 Asia/Saigon",
    feedCount: 2,
    itemCount: 1,
    provider: "gemini",
    model: "gemini-2.0-flash",
    runId: "run-1",
    digest: {
      title: "Daily Digest: 2026-05-19",
      executiveSummary: "One important thing happened.",
      sections: [
        {
          heading: "Top Stories",
          bullets: [
            {
              title: "Story [One]",
              summary: "Short summary.",
              url: "https://example.com/story",
              source: "Example"
            }
          ]
        }
      ],
      moreLinks: []
    }
  });

  assertStringIncludes(markdown, "# Daily Digest: 2026-05-19");
  assertStringIncludes(markdown, "Sources: 2 feeds, 1 items");
  assertStringIncludes(markdown, "**[Story \\[One\\]](https://example.com/story)** - Short summary.");
  assertStringIncludes(markdown, "Run: run-1");
});
```

- [ ] **Step 7: Implement Markdown renderer**

Create `supabase/functions/_shared/digestMarkdown.ts`:

```ts
import type { DigestSummary } from "./ai/types.ts";

function escapeMarkdown(text: string): string {
  return text.replace(/([\\[\]])/g, "\\$1").trim();
}

export function renderDigestMarkdown(input: {
  date: string;
  generatedAt: string;
  feedCount: number;
  itemCount: number;
  provider: string;
  model: string;
  runId: string;
  digest: DigestSummary;
}): string {
  const lines: string[] = [
    `# Daily Digest: ${input.date}`,
    "",
    `Generated: ${input.generatedAt}`,
    `Sources: ${input.feedCount} feeds, ${input.itemCount} items`,
    `Provider: ${input.provider} / ${input.model}`,
    "",
    "## Executive Summary",
    "",
    input.digest.executiveSummary.trim(),
    ""
  ];

  for (const section of input.digest.sections) {
    lines.push(`## ${escapeMarkdown(section.heading)}`, "");
    for (const bullet of section.bullets) {
      lines.push(`- **[${escapeMarkdown(bullet.title)}](${bullet.url})** - ${bullet.summary.trim()}`);
      lines.push(`  Source: ${escapeMarkdown(bullet.source)}`);
    }
    lines.push("");
  }

  if (input.digest.moreLinks?.length) {
    lines.push("## More Links", "");
    for (const link of input.digest.moreLinks) {
      lines.push(`- [${escapeMarkdown(link.title)}](${link.url}) - ${escapeMarkdown(link.source)}`);
    }
    lines.push("");
  }

  lines.push("---", "", `Run: ${input.runId}`, "");
  return lines.join("\n");
}
```

- [ ] **Step 8: Verify AI and Markdown tests**

Run:

```bash
deno test --allow-env supabase/functions/_shared
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add supabase/functions/_shared supabase/functions/deno.json
git commit -m "feat: add ai provider and markdown rendering"
```

Expected: commit succeeds.

## Task 5: Implement `generate-daily-digest` Edge Function

**Files:**
- Create: `supabase/functions/_shared/logging.ts`
- Create: `supabase/functions/generate-daily-digest/index.ts`

- [ ] **Step 1: Add logging helper**

Create `supabase/functions/_shared/logging.ts`:

```ts
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function logEvent(
  supabase: SupabaseClient,
  level: "debug" | "info" | "warn" | "error",
  source: string,
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("app_logs").insert({ level, source, message, context });
  if (error) {
    console.error("Failed to write app log", { level, source, message, context, error });
  }
}
```

- [ ] **Step 2: Implement generation function**

Create `supabase/functions/generate-daily-digest/index.ts`:

```ts
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
  feeds: { title: string | null; url: string } | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function fallbackDigest(date: string, items: DigestInputItem[]): DigestSummary {
  return {
    title: `Daily Digest: ${date}`,
    executiveSummary: "AI summarization was unavailable, so this digest contains the selected RSS links.",
    sections: [
      {
        heading: "Links",
        bullets: items.map((item) => ({
          title: item.title,
          summary: item.description || "No RSS description was provided.",
          url: item.url,
          source: item.feedTitle
        }))
      }
    ],
    moreLinks: []
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

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const { data: users, error: ownerError } = await supabase.auth.admin.listUsers();
  const owner = users.users.find((user) => user.email === config.ownerEmail);

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
      ai_model: config.geminiModel
    })
    .select()
    .single();

  if (runError) {
    return jsonResponse({ error: runError.message }, 500);
  }

  const { error: lockError } = await supabase
    .from("digest_locks")
    .insert({ digest_date: targetDate, run_id: run.id });

  if (lockError) {
    await supabase
      .from("digest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: `Digest generation already running or completed for ${targetDate}`
      })
      .eq("id", run.id);
    return jsonResponse({ error: `Digest generation already running or completed for ${targetDate}` }, 409);
  }

  await logEvent(supabase, "info", "generate-daily-digest", "digest_run_started", {
    run_id: run.id,
    digest_date: targetDate
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
        await logEvent(supabase, "info", "generate-daily-digest", "feed_fetch_started", {
          run_id: run.id,
          feed_id: feed.id
        });
        const response = await fetch(feed.url, {
          headers: { "User-Agent": "RSS Digest App/0.1" }
        });
        if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
        const xml = await response.text();
        const parsed = await parseFeed(xml, feed.id, feed.url, config.digestDescriptionMaxChars);

        if (parsed.feedTitle || parsed.siteUrl) {
          await supabase
            .from("feeds")
            .update({
              title: feed.title ?? parsed.feedTitle,
              site_url: parsed.siteUrl,
              last_fetched_at: new Date().toISOString(),
              last_error: null
            })
            .eq("id", feed.id);
        }

        if (parsed.items.length > 0) {
          const { error: insertError } = await supabase.from("rss_items").upsert(
            parsed.items.map((item) => ({
              feed_id: item.feedId,
              guid: item.guid,
              url: item.url,
              normalized_url: item.normalizedUrl,
              title: item.title,
              description: item.description,
              published_at: item.publishedAt,
              content_hash: item.contentHash
            })),
            { onConflict: "feed_id,content_hash", ignoreDuplicates: true }
          );
          if (insertError) throw insertError;
          insertedItemCount += parsed.items.length;
        }

        await logEvent(supabase, "info", "generate-daily-digest", "feed_fetch_succeeded", {
          run_id: run.id,
          feed_id: feed.id,
          item_count: parsed.items.length
        });
      } catch (error) {
        failedFeedCount += 1;
        await supabase.from("feeds").update({ last_error: String(error) }).eq("id", feed.id);
        await logEvent(supabase, "warn", "generate-daily-digest", "feed_fetch_failed", {
          run_id: run.id,
          feed_id: feed.id,
          error: String(error)
        });
      }
    }

    const start = `${targetDate}T00:00:00.000Z`;
    const end = `${targetDate}T23:59:59.999Z`;
    const { data: candidates, error: candidatesError } = await supabase
      .from("rss_items")
      .select("id,title,description,url,published_at,feeds(title,url)")
      .gte("fetched_at", start)
      .lte("fetched_at", end)
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
      description: item.description ?? undefined
    }));

    let digest: DigestSummary;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let status: "succeeded" | "partial" = failedFeedCount > 0 ? "partial" : "succeeded";

    if (items.length === 0) {
      digest = {
        title: `Daily Digest: ${targetDate}`,
        executiveSummary: "No RSS items were found for this date.",
        sections: [],
        moreLinks: []
      };
    } else {
      try {
        await logEvent(supabase, "info", "generate-daily-digest", "ai_summary_started", {
          run_id: run.id,
          selected_item_count: items.length
        });
        const provider = createAiProvider(config);
        const result = await provider.summarizeDailyDigest({
          date: targetDate,
          items,
          maxItems: config.digestMaxItems,
          maxOutputTokens: config.digestMaxOutputTokens
        });
        digest = result.digest;
        inputTokens = result.usage?.inputTokens;
        outputTokens = result.usage?.outputTokens;
      } catch (error) {
        status = "partial";
        digest = fallbackDigest(targetDate, items);
        await logEvent(supabase, "warn", "generate-daily-digest", "ai_summary_failed", {
          run_id: run.id,
          error: String(error)
        });
      }
    }

    const generatedAt = `${new Date().toISOString()} ${config.timezone}`;
    const markdown = renderDigestMarkdown({
      date: targetDate,
      generatedAt,
      feedCount: feeds?.length ?? 0,
      itemCount: items.length,
      provider: config.aiProvider,
      model: config.geminiModel,
      runId: run.id,
      digest
    });
    const storagePath = digestStoragePath(targetDate);
    const { error: uploadError } = await supabase.storage
      .from("digests")
      .upload(storagePath, markdown, {
        contentType: "text/markdown; charset=utf-8",
        upsert: true
      });
    if (uploadError) throw uploadError;

    await supabase.from("daily_digests").upsert(
      {
        owner_id: owner.id,
        digest_date: targetDate,
        storage_bucket: "digests",
        storage_path: storagePath,
        title: digest.title,
        summary: digest.executiveSummary,
        item_count: items.length,
        run_id: run.id
      },
      { onConflict: "owner_id,digest_date" }
    );

    await supabase
      .from("digest_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        feed_count: feeds?.length ?? 0,
        failed_feed_count: failedFeedCount,
        item_count: insertedItemCount,
        selected_item_count: items.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens
      })
      .eq("id", run.id);

    await supabase.from("digest_locks").delete().eq("digest_date", targetDate);

    await logEvent(supabase, "info", "generate-daily-digest", "digest_run_finished", {
      run_id: run.id,
      status
    });

    return jsonResponse({ runId: run.id, date: targetDate, status });
  } catch (error) {
    await supabase
      .from("digest_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: String(error)
      })
      .eq("id", run.id);

    await supabase.from("digest_locks").delete().eq("digest_date", targetDate);

    await logEvent(supabase, "error", "generate-daily-digest", "digest_run_failed", {
      run_id: run.id,
      error: String(error)
    });

    return jsonResponse({ error: String(error), runId: run.id }, 500);
  }
});
```

- [ ] **Step 3: Type-check function with Supabase CLI**

Run:

```bash
supabase functions serve generate-daily-digest --no-verify-jwt
```

Expected: function starts without TypeScript errors.

- [ ] **Step 4: Commit**

Run:

```bash
git add supabase/functions/_shared/logging.ts supabase/functions/generate-daily-digest
git commit -m "feat: add daily digest generation function"
```

Expected: commit succeeds.

## Task 6: Implement `get-digest` Edge Function

**Files:**
- Create: `supabase/functions/get-digest/index.ts`

- [ ] **Step 1: Implement digest reader**

Create `supabase/functions/get-digest/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getConfig } from "../_shared/config.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

Deno.serve(async (request) => {
  const config = getConfig();
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

  const userClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const serviceClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user || userData.user.email !== config.ownerEmail) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ error: "Expected date query param in YYYY-MM-DD format" }, 400);
  }

  const { data: digest, error: digestError } = await serviceClient
    .from("daily_digests")
    .select("storage_bucket, storage_path")
    .eq("owner_id", userData.user.id)
    .eq("digest_date", date)
    .maybeSingle();

  if (digestError) return jsonResponse({ error: digestError.message }, 500);
  if (!digest) return jsonResponse({ error: "Digest not found" }, 404);

  const { data: file, error: fileError } = await serviceClient.storage
    .from(digest.storage_bucket)
    .download(digest.storage_path);

  if (fileError) return jsonResponse({ error: fileError.message }, 500);

  return new Response(await file.text(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "private, max-age=60"
    }
  });
});
```

- [ ] **Step 2: Type-check function**

Run:

```bash
supabase functions serve get-digest --no-verify-jwt
```

Expected: function starts without TypeScript errors.

- [ ] **Step 3: Commit**

Run:

```bash
git add supabase/functions/get-digest
git commit -m "feat: add private digest reader function"
```

Expected: commit succeeds.

## Task 7: Build Frontend Supabase API Layer

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/supabaseClient.ts`
- Create: `src/api/digestsApi.ts`
- Create: `src/api/feedsApi.ts`
- Create: `src/api/runsApi.ts`

- [ ] **Step 1: Add env reader**

Create `src/lib/env.ts`:

```ts
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
};

export function requireFrontendEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  return {
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey
  };
}
```

- [ ] **Step 2: Add Supabase client**

Create `src/lib/supabaseClient.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { requireFrontendEnv } from "./env";

const config = requireFrontendEnv();

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
```

- [ ] **Step 3: Add digest API**

Create `src/api/digestsApi.ts`:

```ts
import { supabase } from "../lib/supabaseClient";

export type DailyDigest = {
  id: string;
  digest_date: string;
  title: string;
  summary: string | null;
  item_count: number;
  generated_at: string;
};

export async function listDigests(): Promise<DailyDigest[]> {
  const { data, error } = await supabase
    .from("daily_digests")
    .select("id,digest_date,title,summary,item_count,generated_at")
    .order("digest_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDigestMarkdown(date: string): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Sign in before reading digests");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-digest?date=${encodeURIComponent(date)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}
```

This uses direct `fetch` because `get-digest` is a `GET` endpoint with a query parameter.

- [ ] **Step 4: Add feeds API**

Create `src/api/feedsApi.ts`:

```ts
import { supabase } from "../lib/supabaseClient";

export type Feed = {
  id: string;
  owner_id: string;
  title: string | null;
  url: string;
  site_url: string | null;
  category: string | null;
  is_active: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
};

export async function listFeeds(): Promise<Feed[]> {
  const { data, error } = await supabase
    .from("feeds")
    .select("id,owner_id,title,url,site_url,category,is_active,last_fetched_at,last_error")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFeed(input: { url: string; title?: string; category?: string }): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in before adding feeds");
  const { error } = await supabase.from("feeds").insert({
    owner_id: userData.user.id,
    url: input.url,
    title: input.title || null,
    category: input.category || null
  });
  if (error) throw error;
}

export async function updateFeed(id: string, input: Partial<Pick<Feed, "title" | "category" | "is_active">>): Promise<void> {
  const { error } = await supabase.from("feeds").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteFeed(id: string): Promise<void> {
  const { error } = await supabase.from("feeds").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 5: Add runs API**

Create `src/api/runsApi.ts`:

```ts
import { supabase } from "../lib/supabaseClient";

export type DigestRun = {
  id: string;
  run_date: string;
  status: "running" | "succeeded" | "failed" | "partial";
  started_at: string;
  finished_at: string | null;
  feed_count: number;
  failed_feed_count: number;
  selected_item_count: number;
  error: string | null;
};

export async function listRecentRuns(): Promise<DigestRun[]> {
  const { data, error } = await supabase
    .from("digest_runs")
    .select("id,run_date,status,started_at,finished_at,feed_count,failed_feed_count,selected_item_count,error")
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 6: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib src/api
git commit -m "feat: add frontend supabase api layer"
```

Expected: commit succeeds.

## Task 8: Build Frontend Layout and Digest Browsing

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/DigestList.tsx`
- Create: `src/components/DigestViewer.tsx`
- Create: `src/components/MarkdownRenderer.tsx`
- Create: `src/components/RunStatusBadge.tsx`
- Create: `src/components/ErrorNotice.tsx`
- Create: `src/components/EmptyState.tsx`
- Create: `src/pages/DigestsPage.tsx`
- Create: `src/pages/DigestDetailPage.tsx`
- Create: `src/pages/FeedsPage.tsx`
- Create: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add Markdown renderer**

Create `src/components/MarkdownRenderer.tsx`:

```tsx
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  return (
    <article className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
```

- [ ] **Step 2: Add utility UI components**

Create `src/components/ErrorNotice.tsx`:

```tsx
export function ErrorNotice({ message }: { message: string }) {
  return <div className="notice notice-error">{message}</div>;
}
```

Create `src/components/EmptyState.tsx`:

```tsx
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
```

Create `src/components/RunStatusBadge.tsx`:

```tsx
export function RunStatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{status}</span>;
}
```

- [ ] **Step 3: Add app shell**

Create `src/components/AppShell.tsx`:

```tsx
import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, Rss, Settings } from "lucide-react";

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">RSS Digest</div>
        <nav>
          <NavLink to="/digests"><BookOpen size={18} />Digests</NavLink>
          <NavLink to="/feeds"><Rss size={18} />Feeds</NavLink>
          <NavLink to="/settings"><Settings size={18} />Settings</NavLink>
        </nav>
      </aside>
      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Add digest list and viewer**

Create `src/components/DigestList.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { DailyDigest } from "../api/digestsApi";

export function DigestList({ digests }: { digests: DailyDigest[] }) {
  return (
    <div className="digest-list">
      {digests.map((digest) => (
        <Link className="digest-row" key={digest.id} to={`/digests/${digest.digest_date}`}>
          <div>
            <strong>{digest.title}</strong>
            <p>{digest.summary || "No summary saved."}</p>
          </div>
          <span>{digest.item_count} items</span>
        </Link>
      ))}
    </div>
  );
}
```

Create `src/components/DigestViewer.tsx`:

```tsx
import { MarkdownRenderer } from "./MarkdownRenderer";

export function DigestViewer({ markdown }: { markdown: string }) {
  return <MarkdownRenderer markdown={markdown} />;
}
```

- [ ] **Step 5: Add digest pages**

Create `src/pages/DigestsPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { DigestList } from "../components/DigestList";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { type DailyDigest, listDigests } from "../api/digestsApi";

export function DigestsPage() {
  const [digests, setDigests] = useState<DailyDigest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDigests()
      .then(setDigests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading digests...</p>;
  if (error) return <ErrorNotice message={error} />;
  if (digests.length === 0) {
    return <EmptyState title="No digests yet" body="Add feeds, then run daily generation." />;
  }

  return (
    <section>
      <h1>Daily Digests</h1>
      <DigestList digests={digests} />
    </section>
  );
}
```

Create `src/pages/DigestDetailPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDigestMarkdown } from "../api/digestsApi";
import { DigestViewer } from "../components/DigestViewer";
import { ErrorNotice } from "../components/ErrorNotice";

export function DigestDetailPage() {
  const { date } = useParams();
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    getDigestMarkdown(date)
      .then(setMarkdown)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <section>
      <Link to="/digests" className="back-link">Back to digests</Link>
      {loading && <p>Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && <DigestViewer markdown={markdown} />}
    </section>
  );
}
```

- [ ] **Step 6: Wire routes**

Create temporary `src/pages/FeedsPage.tsx` so this task builds before Task 9 expands feed management:

```tsx
export function FeedsPage() {
  return (
    <section>
      <h1>Feeds</h1>
      <p>Feed management is added in the next task.</p>
    </section>
  );
}
```

Create temporary `src/pages/SettingsPage.tsx` so this task builds before Task 9 expands run status:

```tsx
export function SettingsPage() {
  return (
    <section>
      <h1>Settings</h1>
      <p>Run status is added in the next task.</p>
    </section>
  );
}
```

Modify `src/App.tsx`:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DigestDetailPage } from "./pages/DigestDetailPage";
import { DigestsPage } from "./pages/DigestsPage";
import { FeedsPage } from "./pages/FeedsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/digests" replace />} />
        <Route path="/digests" element={<DigestsPage />} />
        <Route path="/digests/:date" element={<DigestDetailPage />} />
        <Route path="/feeds" element={<FeedsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 7: Add layout CSS**

Append to `src/styles.css`:

```css
.app-shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: #102820;
  color: #f8f4e9;
  padding: 24px;
}

.brand {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 28px;
}

.sidebar nav {
  display: grid;
  gap: 8px;
}

.sidebar a {
  align-items: center;
  border-radius: 8px;
  color: inherit;
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  text-decoration: none;
}

.sidebar a.active,
.sidebar a:hover {
  background: rgba(255, 255, 255, 0.12);
}

.main-panel {
  padding: 32px;
}

.digest-list {
  display: grid;
  gap: 12px;
}

.digest-row {
  align-items: center;
  background: #ffffff;
  border: 1px solid #ddd5c5;
  border-radius: 8px;
  color: inherit;
  display: flex;
  justify-content: space-between;
  padding: 16px;
  text-decoration: none;
}

.digest-row p {
  color: #5d665f;
  margin: 6px 0 0;
}

.notice,
.empty-state {
  background: #ffffff;
  border: 1px solid #ddd5c5;
  border-radius: 8px;
  padding: 18px;
}

.notice-error {
  border-color: #d26a5c;
  color: #8b2f25;
}

.markdown {
  background: #ffffff;
  border: 1px solid #ddd5c5;
  border-radius: 8px;
  max-width: 880px;
  padding: 28px;
}

.markdown h1,
.markdown h2 {
  color: #102820;
}

.back-link {
  display: inline-block;
  margin-bottom: 16px;
}

@media (max-width: 760px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    padding: 16px;
  }

  .sidebar nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .main-panel {
    padding: 18px;
  }
}
```

- [ ] **Step 8: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src
git commit -m "feat: add digest browsing UI"
```

Expected: commit succeeds.

## Task 9: Build Feed Management and Settings UI

**Files:**
- Create: `src/components/FeedForm.tsx`
- Create: `src/components/FeedList.tsx`
- Create: `src/components/DatePicker.tsx`
- Modify: `src/pages/FeedsPage.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add feed form**

Create `src/components/FeedForm.tsx`:

```tsx
import { FormEvent, useState } from "react";

export function FeedForm({ onSubmit }: { onSubmit: (input: { url: string; title?: string; category?: string }) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ url, title, category });
      setUrl("");
      setTitle("");
      setCategory("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="feed-form" onSubmit={handleSubmit}>
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="RSS URL" required />
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
      <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
      <button type="submit" disabled={saving}>{saving ? "Adding..." : "Add feed"}</button>
    </form>
  );
}
```

- [ ] **Step 2: Add feed list**

Create `src/components/FeedList.tsx`:

```tsx
import type { Feed } from "../api/feedsApi";

export function FeedList({
  feeds,
  onToggle,
  onDelete
}: {
  feeds: Feed[];
  onToggle: (feed: Feed) => Promise<void>;
  onDelete: (feed: Feed) => Promise<void>;
}) {
  return (
    <div className="feed-list">
      {feeds.map((feed) => (
        <div className="feed-row" key={feed.id}>
          <div>
            <strong>{feed.title || feed.url}</strong>
            <p>{feed.url}</p>
            {feed.last_error && <p className="error-text">{feed.last_error}</p>}
          </div>
          <div className="feed-actions">
            <button type="button" onClick={() => onToggle(feed)}>
              {feed.is_active ? "Disable" : "Enable"}
            </button>
            <button type="button" onClick={() => onDelete(feed)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add feeds page**

Replace `src/pages/FeedsPage.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { createFeed, deleteFeed, type Feed, listFeeds, updateFeed } from "../api/feedsApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { FeedForm } from "../components/FeedForm";
import { FeedList } from "../components/FeedList";

export function FeedsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setFeeds(await listFeeds());
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function addFeed(input: { url: string; title?: string; category?: string }) {
    await createFeed(input);
    await refresh();
  }

  async function toggleFeed(feed: Feed) {
    await updateFeed(feed.id, { is_active: !feed.is_active });
    await refresh();
  }

  async function removeFeed(feed: Feed) {
    await deleteFeed(feed.id);
    await refresh();
  }

  return (
    <section>
      <h1>Feeds</h1>
      {error && <ErrorNotice message={error} />}
      <FeedForm onSubmit={addFeed} />
      {feeds.length === 0
        ? <EmptyState title="No feeds" body="Add RSS feeds to create daily digests." />
        : <FeedList feeds={feeds} onToggle={toggleFeed} onDelete={removeFeed} />}
    </section>
  );
}
```

- [ ] **Step 4: Add date picker**

Create `src/components/DatePicker.tsx`:

```tsx
export function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="date-picker">
      Date
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
```

- [ ] **Step 5: Add settings page**

Replace `src/pages/SettingsPage.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { listRecentRuns, type DigestRun } from "../api/runsApi";
import { ErrorNotice } from "../components/ErrorNotice";
import { RunStatusBadge } from "../components/RunStatusBadge";

export function SettingsPage() {
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecentRuns()
      .then(setRuns)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h1>Settings</h1>
      <div className="settings-panel">
        <p>Daily generation runs at 07:00 Asia/Saigon when Supabase Cron is configured.</p>
        <p>AI provider: Gemini</p>
      </div>
      <h2>Recent Runs</h2>
      {error && <ErrorNotice message={error} />}
      <div className="run-list">
        {runs.map((run) => (
          <div className="run-row" key={run.id}>
            <div>
              <strong>{run.run_date}</strong>
              <p>{run.selected_item_count} selected items, {run.failed_feed_count} failed feeds</p>
              {run.error && <p className="error-text">{run.error}</p>}
            </div>
            <RunStatusBadge status={run.status} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add feed/settings CSS**

Append to `src/styles.css`:

```css
.feed-form {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(220px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) auto;
  margin-bottom: 18px;
}

.feed-form input,
.date-picker input {
  border: 1px solid #cfc6b6;
  border-radius: 8px;
  padding: 10px 12px;
}

.feed-form button,
.feed-actions button {
  background: #102820;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  cursor: pointer;
  padding: 10px 12px;
}

.feed-list,
.run-list {
  display: grid;
  gap: 12px;
}

.feed-row,
.run-row,
.settings-panel {
  align-items: center;
  background: #ffffff;
  border: 1px solid #ddd5c5;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  padding: 16px;
}

.feed-row p,
.run-row p {
  color: #5d665f;
  margin: 6px 0 0;
}

.feed-actions {
  display: flex;
  gap: 8px;
}

.error-text {
  color: #8b2f25;
}

.status {
  border-radius: 999px;
  font-size: 13px;
  padding: 4px 10px;
  text-transform: capitalize;
}

.status-succeeded {
  background: #dcefd8;
  color: #245c2d;
}

.status-partial {
  background: #fff1c8;
  color: #715200;
}

.status-failed {
  background: #f8d8d4;
  color: #8b2f25;
}

.status-running {
  background: #dce7f5;
  color: #284e77;
}

@media (max-width: 900px) {
  .feed-form {
    grid-template-columns: 1fr;
  }

  .feed-row,
  .run-row {
    align-items: flex-start;
    display: grid;
    gap: 12px;
  }
}
```

- [ ] **Step 7: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src
git commit -m "feat: add feed management UI"
```

Expected: commit succeeds.

## Task 10: Verification and MVP Polish

**Files:**
- Modify: `docs/setup.md`

- [ ] **Step 1: Run frontend tests**

Run:

```bash
npm test
```

Expected: PASS. If no frontend tests exist yet, Vitest exits cleanly with no test files or add a smoke test for `App`.

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run Edge Function tests**

Run:

```bash
deno test --allow-env supabase/functions/_shared
```

Expected: PASS.

- [ ] **Step 4: Start local Supabase**

Run:

```bash
supabase start
supabase db reset
```

Expected: local Supabase starts and migrations apply.

- [ ] **Step 5: Serve functions locally**

Run:

```bash
supabase functions serve generate-daily-digest --no-verify-jwt
supabase functions serve get-digest --no-verify-jwt
```

Expected: each function starts without TypeScript errors. Run them in separate terminals.

- [ ] **Step 6: Add manual verification checklist to setup docs**

Append to `docs/setup.md`:

```md
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
```

- [ ] **Step 7: Commit verification docs**

Run:

```bash
git add docs/setup.md
git commit -m "docs: add mvp verification checklist"
```

Expected: commit succeeds.

## Self-Review Checklist

Spec coverage:

- MVP scope: Tasks 1, 7, 8, 9, and 10 build the web app, feed management, digest browsing, and verification.
- Supabase Postgres metadata: Task 2 creates feeds, rss_items, digest_runs, daily_digests, and app_logs.
- Supabase Storage Markdown files: Task 2 creates private bucket, Task 5 uploads Markdown.
- Edge Functions: Tasks 5 and 6 create `generate-daily-digest` and `get-digest`.
- Supabase Cron: Task 2 creates scheduled invocation SQL.
- Gemini with provider abstraction: Task 4 creates `AiProvider`, factory, prompt, and Gemini implementation.
- Token minimization: Task 3 cleans/truncates descriptions, Task 4 sends compact JSON, Task 5 enforces item caps.
- Markdown digest template: Task 4 implements deterministic local rendering.
- Frontend pages/components: Tasks 8 and 9 build digest, feed, and settings UI.
- Error handling/logging: Tasks 5 and 6 implement run status, partial runs, fallback digest, and app logs.
- Security/RLS: Task 2 enables RLS and owner policies; Tasks 5 and 6 keep service credentials server-side.
- Technical risks: Tasks 3, 4, 5, and 10 address malformed RSS, AI failure, token control, Storage access, and verification.

Known implementation caution:

- The plan uses `supabase.auth.admin.listUsers()` for owner lookup because Edge Functions should not query `auth.users` through the public table API.
- The frontend uses direct `fetch` for `get-digest` because Supabase JS `functions.invoke` is awkward for `GET` query parameters.
- Hosted Supabase may require Cron secrets to be stored through Vault rather than database settings. If `current_setting('app.cron_secret')` is not acceptable in the target project, replace Task 2 Step 4 with the Supabase Vault pattern documented for scheduled Edge Functions.
