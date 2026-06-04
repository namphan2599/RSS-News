# Public Admin Route Design

## Goal

Separate the public digest-reading experience from private feed administration.

Public visitors should read digests without seeing source-management navigation. Signed-in owners should use a single admin route to add feeds, update feed metadata/status, and check feed/run health.

## Scope

- Remove the sidebar and menu navigation from the public app shell.
- Keep public digest routes available at `/`, `/digests`, and `/digests/:date`.
- Add `/admin` as the private owner route.
- Require login for `/admin`; unauthenticated users redirect to `/login`.
- Reuse the existing magic-link login flow.
- Combine feed management and recent run status into the admin page.
- Redirect old `/feeds` and `/settings` routes to `/admin` to avoid broken links.

## Architecture

`App.tsx` owns the public/private route split:

- Public routes render through `AppShell`.
- `/admin` renders inside `RequireAuth`.
- `/login` remains public.

`AppShell` becomes a public layout only. It keeps the theme toggle and main content panel, but removes sidebar state, menu buttons, nav links, and overlay markup.

`AdminPage` replaces the separate feeds/settings experience for owner operations. It reuses existing API modules instead of adding new data access paths.

## Admin Page Behavior

Admin page shows:

- Feed add form.
- Feed list with active/inactive state.
- Inline feed update controls for title and category.
- Delete feed action.
- Last fetched timestamp and last error for feed status.
- Recent digest runs with status, selected item count, failed feed count, and run error.

Feed operations refresh the feed list after success. Run status loads on page entry and can remain read-only.

## Data Flow

- `listFeeds`, `createFeed`, `updateFeed`, and `deleteFeed` continue to read/write `feeds` through Supabase RLS.
- `listRecentRuns` continues to read `digest_runs`.
- Feed updates use existing `updateFeed`, expanding its accepted fields only if needed for editable title/category/status.
- No service-role keys or privileged secrets move into frontend code.

## Error Handling

- Feed and run load errors render `ErrorNotice`.
- Add/update/delete errors surface in the admin page instead of silently failing.
- Login redirect remains handled by `RequireAuth`.

## Testing

- Update app routing tests for no public sidebar/menu.
- Add or update tests confirming `/admin` renders feed/admin controls when authenticated.
- Add test coverage for `/feeds` and `/settings` redirecting to `/admin`.
- Run `npm run test`, `npm run lint`, and `npm run build` after implementation.
