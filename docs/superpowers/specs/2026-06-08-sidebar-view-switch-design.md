# Sidebar View Switch Design

## Goal

Add sidebar-owned navigation between Digest and Reddit views. Digest view uses sidebar date controls and renders only markdown content in the main panel. Reddit view displays Reddit posts grouped by date.

## Approved UI

- Replace separate Digest/Reddit nav links with a segmented tab switch in `AppShell`.
- Active tab reflects current route.
- Digest tab navigates to `/digests/:date` using the selected date, falling back to `/digests` for today's date on first load.
- Reddit tab navigates to `/reddit`.
- Show digest date controls only while the Digest route is active.
- Hide digest date controls while Reddit or Admin is active.
- Keep Admin navigation available separately.
- Keep theme button at the bottom of the sidebar.

## Digest Behavior

- Digest date is controlled from the sidebar with `Previous`, `Next`, and a date input.
- Changing date updates the digest content.
- The digest main panel removes the `Daily Digest` page title, intro, link, and article chrome.
- The main panel renders markdown content directly when a digest exists.
- Loading, error, missing digest, and empty summary states remain visible in the main panel.

## Reddit Behavior

- Reddit view hides digest date controls.
- Reddit posts display grouped by `summary_date`.
- Existing selected-post reader behavior remains.
- Posts remain ordered by newest `summary_date`, then publish/fetch time as currently returned by `listRedditPostSummaries`.

## Data Flow

- `AppShell` owns selected digest date because sidebar controls need to drive digest content.
- `DigestsPage` receives selected date from the routed parent and loads content for that date.
- `RedditNewsPage` continues loading its own data through `listRedditPostSummaries`.
- No schema or Supabase changes are needed.

## Testing

- Update app tests for segmented sidebar tabs.
- Verify digest prev/next controls from sidebar load the expected dates.
- Verify digest markdown renders without the old page header.
- Verify Reddit posts are grouped by date.
