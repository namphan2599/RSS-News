# Hono Edge Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the public digest read Edge Function to Hono while keeping digest generation as a separate unauthenticated plain scheduled function.

**Architecture:** `get-digest` becomes a public Hono `GET /` endpoint that uses the service role client to fetch digest markdown by date. `generate-daily-digest` stays separate as plain `Deno.serve(handleGenerateDailyDigest)` and no longer requires a cron secret header.

**Tech Stack:** Supabase Edge Functions, Deno, Hono via `jsr:@hono/hono`, Supabase JS, pg_cron, Deno tests.

---

## File Structure

- Modify: `supabase/functions/deno.json` — add Hono import alias.
- Modify: `supabase/config.toml` — disable Supabase JWT verification for public `get-digest`.
- Modify: `supabase/functions/get-digest/index.ts` — public Hono app and compatibility handler.
- Create: `supabase/functions/get-digest/index.test.ts` — verify public read endpoint behavior with injected dependencies.
- Modify: `supabase/functions/generate-daily-digest/index.ts` — remove cron-secret rejection while keeping plain Deno handler.
- Modify: `supabase/functions/generate-daily-digest/index.test.ts` — verify generation handler no longer rejects missing cron secret.
- Modify: `supabase/migrations/202605190003_cron.sql` — schedule generation every 3 hours and remove bearer auth header.
- Modify: `src/api/digestsApi.ts` — remove frontend bearer token requirement for public digest markdown fetch.

## Task 1: Add Hono Import Alias

**Files:**
- Modify: `supabase/functions/deno.json`

- [ ] **Step 1: Add Hono alias**

Change imports block to:

```json
"imports": {
  "fast-xml-parser": "npm:fast-xml-parser@4.4.1",
  "hono": "jsr:@hono/hono"
}
```

- [ ] **Step 2: Run Deno cache check**

Run: `deno cache supabase/functions/get-digest/index.ts`

Expected: command exits `0`. If Deno rejects JSR import support in this environment, change the alias to a pinned Hono URL and rerun:

```json
"hono": "https://deno.land/x/hono@v4.6.5/mod.ts"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/deno.json supabase/functions/deno.lock
git commit -m "chore: add hono for edge functions"
```

## Task 2: Make `get-digest` Public With Hono

**Files:**
- Modify: `supabase/config.toml`
- Modify: `supabase/functions/get-digest/index.ts`
- Create: `supabase/functions/get-digest/index.test.ts`

- [ ] **Step 1: Disable gateway JWT verification for get-digest**

Add to `supabase/config.toml`:

```toml
[functions.get-digest]
verify_jwt = false
```

- [ ] **Step 2: Write failing public behavior tests**

Create `supabase/functions/get-digest/index.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createGetDigestApp } from "./index.ts";

Deno.test("get-digest returns markdown without authorization", async () => {
  const app = createGetDigestApp({
    getConfig: () => ({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      supabaseServiceRoleKey: "service-role-key",
      ownerEmail: "owner@example.com",
      timezone: "Asia/Saigon",
      aiProvider: "gemini",
      geminiModel: "gemini-2.0-flash",
      geminiApiKey: "gemini-key",
      cronSecret: "cron-secret",
      digestMaxItems: 60,
      digestMaxItemsPerFeed: 8,
      digestDescriptionMaxChars: 500,
      digestMaxOutputTokens: 2500,
    }),
    createClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({
                  data: {
                    storage_bucket: "digests",
                    storage_path: "2026-05-27.md",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          download: () => Promise.resolve({
            data: new Blob(["# Digest"]),
            error: null,
          }),
        }),
      },
    }),
  });

  const response = await app.request("http://localhost/?date=2026-05-27");

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  assertEquals(await response.text(), "# Digest");
});

Deno.test("get-digest rejects invalid date", async () => {
  const app = createGetDigestApp({
    getConfig: () => ({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
      supabaseServiceRoleKey: "service-role-key",
      ownerEmail: "owner@example.com",
      timezone: "Asia/Saigon",
      aiProvider: "gemini",
      geminiModel: "gemini-2.0-flash",
      geminiApiKey: "gemini-key",
      cronSecret: "cron-secret",
      digestMaxItems: 60,
      digestMaxItemsPerFeed: 8,
      digestDescriptionMaxChars: 500,
      digestMaxOutputTokens: 2500,
    }),
    createClient: () => {
      throw new Error("client should not be created for invalid date");
    },
  });

  const response = await app.request("http://localhost/?date=bad-date");

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: "Expected date query param in YYYY-MM-DD format",
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `deno test --allow-env --allow-net=deno.land,esm.sh supabase/functions/get-digest/index.test.ts`

Expected: FAIL because `createGetDigestApp` is not exported.

- [ ] **Step 4: Implement Hono app and public read flow**

Replace `supabase/functions/get-digest/index.ts` with:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Hono } from "hono";
import { getConfig, type AppConfig } from "../_shared/config.ts";

type GetDigestDependencies = {
  getConfig: () => AppConfig;
  createClient: typeof createClient;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidDate(date: string | null): date is string {
  return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));
}

export function createGetDigestApp(deps: GetDigestDependencies) {
  const app = new Hono();

  app.get("/", async (c) => {
    const config = deps.getConfig();
    const date = c.req.query("date");
    if (!isValidDate(date)) {
      return jsonResponse({
        error: "Expected date query param in YYYY-MM-DD format",
      }, 400);
    }

    const serviceClient = deps.createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
    );

    const { data: digest, error: digestError } = await serviceClient
      .from("daily_digests")
      .select("storage_bucket, storage_path")
      .eq("digest_date", date)
      .order("generated_at", { ascending: false })
      .limit(1)
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
        "Cache-Control": "public, max-age=60",
      },
    });
  });

  return app;
}

export const app = createGetDigestApp({ getConfig, createClient });

export function handleGetDigest(request: Request): Promise<Response> {
  return app.fetch(request);
}

if (import.meta.main) {
  Deno.serve(app.fetch);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --allow-env --allow-net=deno.land,esm.sh,jsr.io supabase/functions/get-digest/index.test.ts`

Expected: PASS for 2 tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/functions/get-digest/index.ts supabase/functions/get-digest/index.test.ts supabase/functions/deno.lock
git commit -m "feat: expose public hono digest reader"
```

## Task 3: Keep `generate-daily-digest` Plain And Remove Cron Secret Gate

**Files:**
- Modify: `supabase/functions/generate-daily-digest/index.ts`
- Modify: `supabase/functions/generate-daily-digest/index.test.ts`

- [ ] **Step 1: Add unauthenticated handler test**

Append to `supabase/functions/generate-daily-digest/index.test.ts`:

```ts
import { handleGenerateDailyDigest } from "./index.ts";

Deno.test("generate-daily-digest handler does not reject missing cron secret", async () => {
  const response = await handleGenerateDailyDigest(new Request("http://localhost/", {
    method: "POST",
    body: JSON.stringify({ date: "not-a-date" }),
    headers: { "Content-Type": "application/json" },
  }));

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "date must use YYYY-MM-DD" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test --allow-env --allow-net=deno.land,esm.sh,jsr.io supabase/functions/generate-daily-digest/index.test.ts`

Expected: FAIL if cron secret is still required with `401`.

- [ ] **Step 3: Remove cron secret rejection**

In `handleGenerateDailyDigest`, delete these lines:

```ts
  const cronHeader = request.headers.get("x-cron-secret") ?? "";

  if (cronHeader !== config.cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
```

The function should begin:

```ts
export async function handleGenerateDailyDigest(request: Request) {
  const config = getConfig();

  const body = await request.json().catch(() => ({}));
  const targetDate = typeof body.date === "string"
    ? body.date
    : formatDateInTimezone(new Date(), config.timezone);
```

- [ ] **Step 4: Keep plain Deno entrypoint**

At end of `supabase/functions/generate-daily-digest/index.ts`, keep:

```ts
if (import.meta.main) {
  Deno.serve(handleGenerateDailyDigest);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `deno test --allow-env --allow-net=deno.land,esm.sh,jsr.io supabase/functions/generate-daily-digest/index.test.ts`

Expected: PASS including unauthenticated handler test.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-daily-digest/index.ts supabase/functions/generate-daily-digest/index.test.ts supabase/functions/deno.lock
git commit -m "feat: allow scheduled digest generation without auth"
```

## Task 4: Update Cron Schedule To Every 3 Hours

**Files:**
- Modify: `supabase/migrations/202605190003_cron.sql`

- [ ] **Step 1: Update cron SQL**

Replace schedule block in `supabase/migrations/202605190003_cron.sql` with:

```sql
select cron.schedule(
  'generate-daily-rss-digest',
  '0 */3 * * *',
  $$
  select
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-daily-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('source', 'cron')
    );
  $$
);
```

- [ ] **Step 2: Verify migration text**

Run: `git diff -- supabase/migrations/202605190003_cron.sql`

Expected: cron expression changed from `0 0 * * *` to `0 */3 * * *`, and `Authorization` header removed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605190003_cron.sql
git commit -m "chore: schedule digest generation every three hours"
```

## Task 5: Remove Frontend Bearer Token From Public Digest Fetch

**Files:**
- Modify: `src/api/digestsApi.ts`

- [ ] **Step 1: Update frontend API helper**

Replace `getDigestMarkdown` in `src/api/digestsApi.ts` with:

```ts
export async function getDigestMarkdown(date: string): Promise<string> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-digest?date=${
      encodeURIComponent(date)
    }`,
  );
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}
```

- [ ] **Step 2: Run frontend tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/digestsApi.ts
git commit -m "feat: read digest markdown publicly"
```

## Task 6: Full Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Run all Deno function tests**

Run from `supabase/functions`: `deno task test`

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Review final diff**

Run: `git diff --stat HEAD~5..HEAD`

Expected: changes limited to Hono import, two Edge Functions, tests, cron migration, and public frontend digest fetch.

## Self-Review

- Spec coverage: public Hono `get-digest`, separate unauthenticated plain scheduled `generate-daily-digest`, 3-hour cron, and tests are covered.
- Placeholder scan: no incomplete placeholders remain.
- Type consistency: `createGetDigestApp`, `app`, `handleGetDigest`, and `handleGenerateDailyDigest` names match planned exports and tests.
