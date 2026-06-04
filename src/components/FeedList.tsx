import { type FormEvent, useState } from "react";
import type { Feed } from "../api/feedsApi";

export function FeedList({
  feeds,
  onToggle,
  onDelete,
  onUpdate,
}: {
  feeds: Feed[];
  onToggle: (feed: Feed) => Promise<void>;
  onDelete: (feed: Feed) => Promise<void>;
  onUpdate: (feed: Feed, input: { title: string; category: string }) => Promise<void>;
}) {
  return (
    <div className="feed-list">
      {feeds.map((feed) => (
        <FeedRow feed={feed} key={feed.id} onDelete={onDelete} onToggle={onToggle} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function FeedRow({
  feed,
  onToggle,
  onDelete,
  onUpdate,
}: {
  feed: Feed;
  onToggle: (feed: Feed) => Promise<void>;
  onDelete: (feed: Feed) => Promise<void>;
  onUpdate: (feed: Feed, input: { title: string; category: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(feed.title ?? "");
  const [category, setCategory] = useState(feed.category ?? "");
  const [saving, setSaving] = useState(false);

  async function saveFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onUpdate(feed, { title, category });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="feed-row">
      <div className="feed-details">
        <strong>{feed.title || feed.url}</strong>
        <p>{feed.url}</p>
        <p>{feed.is_active ? "Active" : "Inactive"}</p>
        <p>{feed.last_fetched_at ? `Last fetched ${feed.last_fetched_at}` : "Never fetched"}</p>
        {feed.last_error && <p className="error-text">{feed.last_error}</p>}
      </div>
      <form className="feed-edit-form" onSubmit={saveFeed}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
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
