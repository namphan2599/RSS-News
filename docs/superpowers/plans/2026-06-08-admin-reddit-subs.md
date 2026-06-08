# Admin Reddit Subs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin UI for managing Reddit subreddit RSS subscriptions.

**Architecture:** Keep Reddit subscription data access in `src/api/redditFeedsApi.ts`. Add focused Reddit form/list components and wire them into `AdminPage` beside existing feed management.

**Tech Stack:** Vite, React, TypeScript, Supabase, Vitest.

---

## Tasks

- [ ] Add tests proving admin renders Reddit Subs and API inserts default Reddit RSS URLs.
- [ ] Add `src/api/redditFeedsApi.ts` with list/create/update/delete functions for `reddit_feeds`.
- [ ] Add `src/components/RedditFeedForm.tsx` and `src/components/RedditFeedList.tsx`.
- [ ] Update `src/pages/AdminPage.tsx` to load and manage Reddit feeds.
- [ ] Run `npm run test`, `npm run lint`, and `npm run build`.
