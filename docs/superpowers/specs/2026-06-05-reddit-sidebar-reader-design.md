# Reddit Sidebar Reader Design

## Goal

Redesign the existing `/reddit` page into a two-pane reader: a left sidebar of Reddit posts and a right markdown summary viewer for the selected post.

## Scope

- Reuse the existing `listRedditPostSummaries()` API and current sort order.
- Select the first loaded post by default, which represents the newest/date-first result from the API.
- Let users click a sidebar item to change the selected post.
- Render the selected post summary with the existing `MarkdownRenderer` component.
- Preserve existing loading, error, and empty states.
- Keep the layout responsive: two columns on desktop, stacked list then summary on mobile.

## Out Of Scope

- New Supabase tables, migrations, or policies.
- New route per Reddit post.
- Persisting selected post across reloads.
- Drawer behavior for mobile.

## UI Design

The page keeps the current Reddit header and back link. When posts are loaded, content changes from a card list to a reader layout.

The left sidebar shows compact post items with subreddit, summary date, title, and published time when available. The active item has clear selected styling and uses a button for accessible click behavior.

The right panel shows the selected post title, metadata, link to the original Reddit post, and the markdown-rendered summary.

## Data Flow

`RedditNewsPage` loads posts once through `listRedditPostSummaries()`. It stores posts, loading, and error as it does today. It also tracks `selectedPostId`. After successful load, the first post is selected. The selected post is derived from `posts` and `selectedPostId`.

## Error And Empty States

Loading, API error, and no-post states remain visible instead of the reader. If posts exist but selected id is missing, the first post is used as a safe fallback.

## Testing

Update existing app tests for `/reddit` to verify:

- Reddit page renders post list and selected markdown summary.
- First post is selected by default.
- Clicking another post changes the displayed summary.
- Original Reddit link remains available.
