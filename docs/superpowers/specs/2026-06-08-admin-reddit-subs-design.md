# Admin Reddit Subs Design

## Goal

Add an admin section for managing Reddit subreddit RSS subscriptions stored in `public.reddit_feeds`.

## Design

Create a small frontend API module for `reddit_feeds` CRUD operations. Add Reddit-specific form and list components that mirror existing feed management styling while using Reddit fields: `subreddit`, `url`, `is_active`, `last_fetched_at`, and `last_error`.

The admin page will load RSS feeds, Reddit feeds, and recent runs together. It will render a new sidebar link and `Reddit Subs` section between `Feeds` and `Recent Runs`.

Adding a Reddit sub accepts a subreddit name and optional RSS URL. If URL is empty, the app builds `https://www.reddit.com/r/<subreddit>/.rss`. Updating supports subreddit and URL edits. Existing enable/disable/delete behavior mirrors RSS feeds.

## Verification

Add tests for the Reddit API URL defaulting and admin rendering. Run Vitest, lint, and build.
