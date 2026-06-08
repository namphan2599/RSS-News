import { type FormEvent, useState } from "react";
import type { RedditFeed } from "../api/redditFeedsApi";

export function RedditFeedList({
  feeds,
  onToggle,
  onDelete,
  onUpdate,
}: {
  feeds: RedditFeed[];
  onToggle: (feed: RedditFeed) => Promise<void>;
  onDelete: (feed: RedditFeed) => Promise<void>;
  onUpdate: (feed: RedditFeed, input: { subreddit: string; url: string }) => Promise<void>;
}) {
  return (
    <div className="feed-list">
      {feeds.map((feed) => (
        <RedditFeedRow feed={feed} key={feed.id} onDelete={onDelete} onToggle={onToggle} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function RedditFeedRow({
  feed,
  onToggle,
  onDelete,
  onUpdate,
}: {
  feed: RedditFeed;
  onToggle: (feed: RedditFeed) => Promise<void>;
  onDelete: (feed: RedditFeed) => Promise<void>;
  onUpdate: (feed: RedditFeed, input: { subreddit: string; url: string }) => Promise<void>;
}) {
  const [subreddit, setSubreddit] = useState(feed.subreddit);
  const [url, setUrl] = useState(feed.url);
  const [saving, setSaving] = useState(false);

  async function saveFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onUpdate(feed, { subreddit, url });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="feed-row">
      <div className="feed-details">
        <strong>r/{feed.subreddit}</strong>
        <p>{feed.url}</p>
        <p>{feed.is_active ? "Active" : "Inactive"}</p>
        <p>{feed.last_fetched_at ? `Last fetched ${feed.last_fetched_at}` : "Never fetched"}</p>
        {feed.last_error && <p className="error-text">{feed.last_error}</p>}
      </div>
      <form className="feed-edit-form" onSubmit={saveFeed}>
        <input value={subreddit} onChange={(event) => setSubreddit(event.target.value)} placeholder="Subreddit" />
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="RSS URL" />
        <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
      </form>
      <div className="feed-actions">
        <button type="button" onClick={() => onToggle(feed)}>
          {feed.is_active ? "Disable" : "Enable"}
        </button>
        <button type="button" onClick={() => onDelete(feed)}>
          Delete
        </button>
      </div>
    </div>
  );
}
