# Admin Source Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show RSS feeds and Reddit subs in one split tab view on admin.

**Architecture:** Keep existing API/components. Add local tab state and small tab button styling inside `AdminPage`.

**Tech Stack:** React, TypeScript, Vitest, CSS.

---

- [ ] Update admin test for `Sources` link, default RSS tab, and Reddit tab switch.
- [ ] Update `AdminPage.tsx` with `activeSourceTab` state and conditional tab panels.
- [ ] Add source tab CSS to `src/styles.css`.
- [ ] Run `npm run test`, `npm run lint`, and `npm run build`.
