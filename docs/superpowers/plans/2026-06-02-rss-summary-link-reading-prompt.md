# RSS Summary Link Reading Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the RSS summary prompt so Gemini reads article links and starts each digest with a short highlights paragraph.

**Architecture:** Keep the current Edge Function flow unchanged. Modify only `buildPrompt` in `supabase/functions/rss-summary/index.ts` so the Gemini request receives clearer instructions.

**Tech Stack:** Supabase Edge Functions, Deno, TypeScript, Gemini API.

---

## File Structure

- Modify: `supabase/functions/rss-summary/index.ts`
- No new runtime files.

### Task 1: Rewrite Digest Prompt

**Files:**
- Modify: `supabase/functions/rss-summary/index.ts:143-160`

- [ ] **Step 1: Replace the prompt text**

Update `buildPrompt` to keep `promptItems` unchanged and replace the returned instruction list with a prompt that requires Gemini to read each `url`, start with a highlights paragraph, group by category/topic, and include links for every mentioned item.

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: command exits successfully without TypeScript errors.
