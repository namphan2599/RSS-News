# Simplify Generate Daily Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `generate-daily-digest` so the Edge Function is a thin wrapper around shared digest job logic.

**Architecture:** Move digest generation types, helpers, and workflow into `supabase/functions/_shared/digestJob.ts`. Keep `supabase/functions/generate-daily-digest/index.ts` responsible only for reading HTTP JSON, loading config, creating Supabase client, calling `runDigestJob`, and returning JSON. Keep behavior unchanged.

**Tech Stack:** Supabase Edge Functions, Deno, Supabase JS, existing Deno tests.

---

## File Structure

- Create: `supabase/functions/_shared/digestJob.ts` — digest job workflow and generation-only helpers.
- Modify: `supabase/functions/generate-daily-digest/index.ts` — thin HTTP wrapper around `runDigestJob`.
- Modify: `supabase/functions/generate-daily-digest/index.test.ts` — import extracted helpers from `_shared/digestJob.ts` and keep wrapper validation test.

## Task 1: Extract Digest Job Module

**Files:**
- Create: `supabase/functions/_shared/digestJob.ts`
- Modify: `supabase/functions/generate-daily-digest/index.ts`

- [ ] **Step 1: Create shared job module**

Move the existing generation imports, row types, constants, helper functions, and the body of `handleGenerateDailyDigest` into `supabase/functions/_shared/digestJob.ts`.

Export this function:

```ts
export async function runDigestJob(input: {
  config: AppConfig;
  supabase: DigestSupabaseClient;
  date?: string;
}): Promise<{ runId: string; date: string; status: "succeeded" | "partial" }>;
```

Keep these existing helper exports for current tests:

```ts
export function getLocalDayUtcBounds(date: string, timezone: string): { start: string; end: string };
export function limitCandidatesPerFeed<T extends { feeds: { url: string } | null }>(candidates: T[], maxItemsPerFeed: number, maxItems: number): T[];
export async function collectCandidatesAcrossPages<T extends { feeds: { url: string } | null }>(input: {
  pageSize: number;
  maxPages: number;
  maxItemsPerFeed: number;
  maxItems: number;
  fetchPage: (from: number, to: number) => Promise<T[]>;
}): Promise<T[]>;
```

- [ ] **Step 2: Replace function file with wrapper**

Make `supabase/functions/generate-daily-digest/index.ts` contain only:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getConfig } from "../_shared/config.ts";
import { formatDateInTimezone } from "../_shared/dates.ts";
import { isValidDigestDate, runDigestJob } from "../_shared/digestJob.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleGenerateDailyDigest(request: Request) {
  const config = getConfig();
  const body = await request.json().catch(() => ({}));
  const targetDate = typeof body.date === "string"
    ? body.date
    : formatDateInTimezone(new Date(), config.timezone);

  if (!isValidDigestDate(targetDate)) {
    return jsonResponse({ error: "date must use YYYY-MM-DD" }, 400);
  }

  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );

  try {
    const result = await runDigestJob({ config, supabase, date: targetDate });
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}

if (import.meta.main) {
  Deno.serve(handleGenerateDailyDigest);
}
```

- [ ] **Step 3: Run focused test**

Run: `deno test --allow-env --allow-net=deno.land,esm.sh,jsr.io supabase/functions/generate-daily-digest/index.test.ts`

Expected: tests compile or fail only because tests still import helpers from old path.

## Task 2: Update Tests For Extracted Helpers

**Files:**
- Modify: `supabase/functions/generate-daily-digest/index.test.ts`

- [ ] **Step 1: Update imports**

Change imports to:

```ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectCandidatesAcrossPages,
  getLocalDayUtcBounds,
  limitCandidatesPerFeed,
} from "../_shared/digestJob.ts";
import { handleGenerateDailyDigest } from "./index.ts";
```

- [ ] **Step 2: Run focused test**

Run: `deno test --allow-env --allow-net=deno.land,esm.sh,jsr.io supabase/functions/generate-daily-digest/index.test.ts`

Expected: PASS.

## Task 3: Verify Function Suite

**Files:**
- No code changes expected.

- [ ] **Step 1: Run all function tests**

Run from `supabase/functions`: `deno task test`

Expected: PASS.

- [ ] **Step 2: Inspect diff**

Run: `git diff -- supabase/functions/generate-daily-digest/index.ts supabase/functions/_shared/digestJob.ts supabase/functions/generate-daily-digest/index.test.ts`

Expected: behavior-preserving extraction; wrapper is small; job code moved to shared module.

## Self-Review

- Spec coverage: keeps `generate-daily-digest` as wrapper, extracts job logic, preserves behavior.
- Placeholder scan: no placeholders.
- Type consistency: `runDigestJob`, `isValidDigestDate`, helper exports, and test imports match planned files.
