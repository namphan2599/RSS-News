import { useEffect, useState } from "react";
import { createFeed, deleteFeed, type Feed, listFeeds, updateFeed } from "../api/feedsApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { FeedForm } from "../components/FeedForm";
import { FeedList } from "../components/FeedList";

export function FeedsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setFeeds(await listFeeds());
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function addFeed(input: { url: string; title?: string; category?: string }) {
    await createFeed(input);
    await refresh();
  }

  async function toggleFeed(feed: Feed) {
    await updateFeed(feed.id, { is_active: !feed.is_active });
    await refresh();
  }

  async function removeFeed(feed: Feed) {
    await deleteFeed(feed.id);
    await refresh();
  }

  return (
    <section>
      <h1>Feeds</h1>
      {error && <ErrorNotice message={error} />}
      <FeedForm onSubmit={addFeed} />
      {feeds.length === 0
        ? <EmptyState title="No feeds" body="Add RSS feeds to create daily digests." />
        : <FeedList feeds={feeds} onToggle={toggleFeed} onDelete={removeFeed} />}
    </section>
  );
}
