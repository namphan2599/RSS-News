# Flutter Public Digest Viewer Design

## Goal

Create a separate Flutter app that reads published RSS daily digests without login. The app is read-only: users can browse recent digests and open a digest detail page with markdown-rendered summary content.

The Flutter project lives outside this web app repository, for example `C:/work/RSS-News-Mobile`. This repository keeps the Supabase schema/API contract that mobile consumes.

## Selected Approach

Use a public read-only Supabase view plus the Flutter Supabase client.

This keeps the base `daily_digests` table owner-controlled while exposing only the columns intended for anonymous readers. It avoids an Edge Function because the app only needs public read queries, and it avoids direct table exposure because the table contains ownership/storage fields that mobile does not need.

## Public Data Contract

Create `public.public_daily_digests` selecting only:

- `id`
- `digest_date`
- `title`
- `summary`
- `item_count`
- `generated_at`

Anonymous users may select from this view. No insert, update, delete, feed management, run status, app logs, owner fields, storage fields, or service-role access are exposed.

The `summary` field is public by product choice. Anything written into `daily_digests.summary` must be safe to publish.

## Supabase Changes

Add a migration in this repository that:

- creates or replaces `public.public_daily_digests`
- grants anonymous select access to the view
- keeps existing RLS and owner-only policies for `public.daily_digests`

If Supabase/Postgres requires the view to respect caller permissions, add the narrowest policy needed for anonymous reads of published digest rows. Do not broaden access to private tables beyond this mobile read contract.

## Flutter App Structure

Use a small Flutter app with these units:

- `main.dart`: initializes Supabase with URL and anon key, starts app.
- `Digest`: model for the public view row.
- `DigestsRepository`: reads `public_daily_digests`, maps rows to `Digest`.
- `DigestListScreen`: loads recent digests, shows loading/error/empty states.
- `DigestDetailScreen`: renders one digest title/date/item count/markdown summary.

Use `supabase_flutter` for data access and a Flutter markdown package for summary rendering. Keep state local with `FutureBuilder` or simple `StatefulWidget`; no global state library is needed for a read-only app.

## UI Behavior

- App opens to latest digests ordered by `digest_date desc`.
- List item shows title, digest date, and item count.
- Tapping a list item opens detail screen.
- Detail screen renders markdown summary if present.
- Empty summary shows a clear empty state instead of a blank page.
- Network/query failure shows a retryable error state.

## Configuration

Flutter app uses public runtime configuration only:

- Supabase URL
- Supabase anon key

Never include service-role keys, owner credentials, or private environment values in Flutter assets or source.

## Testing

Repository/schema verification:

- Confirm anonymous select works for `public_daily_digests`.
- Confirm anonymous access does not expose private base-table fields.

Flutter verification:

- Unit test digest row parsing.
- Widget test list loading, empty, error, and detail rendering states.
- Run Flutter analyzer and tests in the Flutter project.

## Non-Goals

- No login.
- No feed management.
- No settings page.
- No digest generation controls.
- No writes from mobile.
- No schema refactor beyond the public read contract.
