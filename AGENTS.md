# Agent Rules

## Project Stack

- This project uses Vite, React, TypeScript, and Supabase.
- Frontend code lives under `src/`.
- Supabase schema, migrations, Edge Functions, and shared function code live under `supabase/`.

## KISS Principle

- Prefer the smallest correct change that solves the current problem.
- Do not add abstractions, helpers, libraries, or patterns until there is repeated need.
- Keep logic close to where it is used unless it is clearly shared by multiple callers.
- Favor readable functions and explicit data flow over clever or generic code.
- Avoid broad refactors unless they directly reduce risk or complexity for the task.

## React And Frontend

- Preserve existing component structure and styling patterns unless the task requires changing them.
- Keep components focused on one responsibility: rendering UI, managing local UI state, or calling an API wrapper.
- Put Supabase calls behind small API modules in `src/api/` when used by pages or components.
- Keep environment access centralized in `src/lib/env.ts` and Supabase client setup in `src/lib/supabaseClient.ts`.
- Prefer clear loading, empty, and error states over complex state machines.

## Supabase

- Use migrations for schema changes; do not rely on manual dashboard-only schema edits.
- Respect Row Level Security and verify policies when changing tables or access patterns.
- Never expose service-role keys or privileged secrets to frontend code.
- Keep Edge Function shared logic in `supabase/functions/_shared/` only when it is reused.
- Keep database access and external service calls explicit and easy to audit.

## Verification

- Run focused tests for changed code when available.
- Run `npm run lint`, `npm run test`, or `npm run build` when changes affect TypeScript, React behavior, Supabase API contracts, or migrations.
- If verification cannot be run, state the reason and what remains unverified.
