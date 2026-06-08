# Admin Source Tabs Design

## Goal

Group RSS feed and Reddit sub management into one split tab view on the admin page.

## Design

Replace separate admin navigation links for `Feeds` and `Reddit Subs` with one `Sources` link. The `Sources` section contains two tab buttons: `RSS Feeds` and `Reddit Subs`. The RSS tab is active by default. Only the active tab renders its form, list, and empty state. `Recent Runs` remains below source management.

Tab state is local React state. No route or hash state is needed beyond the sidebar `#sources` anchor.

## Verification

Update admin tests to verify default RSS tab rendering, Reddit tab switching, and sidebar `Sources` link. Run Vitest, lint, and build.
