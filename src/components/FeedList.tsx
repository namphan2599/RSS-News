import type { Feed } from "../api/feedsApi";

export function FeedList({
  feeds,
  onToggle,
  onDelete,
}: {
  feeds: Feed[];
  onToggle: (feed: Feed) => Promise<void>;
  onDelete: (feed: Feed) => Promise<void>;
}) {
  return (
    <div className="feed-list">
      {feeds.map((feed) => (
        <div className="feed-row" key={feed.id}>
          <div>
            <strong>{feed.title || feed.url}</strong>
            <p>{feed.url}</p>
            {feed.last_error && <p className="error-text">{feed.last_error}</p>}
          </div>
          <div className="feed-actions">
            <button type="button" onClick={() => onToggle(feed)}>
              {feed.is_active ? "Disable" : "Enable"}
            </button>
            <button type="button" onClick={() => onDelete(feed)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
