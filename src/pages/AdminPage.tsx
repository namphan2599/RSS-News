import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createFeed, deleteFeed, type Feed, listFeeds, updateFeed } from "../api/feedsApi";
import {
  createRedditFeed,
  deleteRedditFeed,
  listRedditFeeds,
  type RedditFeed,
  updateRedditFeed,
} from "../api/redditFeedsApi";
import { listRecentRuns, type DigestRun } from "../api/runsApi";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { FeedForm } from "../components/FeedForm";
import { FeedList } from "../components/FeedList";
import { RedditFeedForm } from "../components/RedditFeedForm";
import { RedditFeedList } from "../components/RedditFeedList";
import { RunStatusBadge } from "../components/RunStatusBadge";

type SourceTab = "feeds" | "reddit";

export function AdminPage() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [redditFeeds, setRedditFeeds] = useState<RedditFeed[]>([]);
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSourceTab, setActiveSourceTab] = useState<SourceTab>("feeds");

  async function refreshFeeds() {
    setFeeds(await listFeeds());
  }

  async function refreshRedditFeeds() {
    setRedditFeeds(await listRedditFeeds());
  }

  useEffect(() => {
    Promise.all([listFeeds(), listRedditFeeds(), listRecentRuns()])
      .then(([nextFeeds, nextRedditFeeds, nextRuns]) => {
        setFeeds(nextFeeds);
        setRedditFeeds(nextRedditFeeds);
        setRuns(nextRuns);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load admin data"));
  }, []);

  async function addFeed(input: { url: string; title?: string; category?: string }) {
    setError(null);
    try {
      await createFeed(input);
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add feed");
    }
  }

  async function saveFeed(feed: Feed, input: { title: string; category: string }) {
    setError(null);
    try {
      await updateFeed(feed.id, { title: input.title || null, category: input.category || null });
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update feed");
    }
  }

  async function toggleFeed(feed: Feed) {
    setError(null);
    try {
      await updateFeed(feed.id, { is_active: !feed.is_active });
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update feed status");
    }
  }

  async function removeFeed(feed: Feed) {
    setError(null);
    try {
      await deleteFeed(feed.id);
      await refreshFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete feed");
    }
  }

  async function addRedditFeed(input: { subreddit: string; url?: string }) {
    setError(null);
    try {
      await createRedditFeed(input);
      await refreshRedditFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add Reddit sub");
    }
  }

  async function saveRedditFeed(feed: RedditFeed, input: { subreddit: string; url: string }) {
    setError(null);
    try {
      await updateRedditFeed(feed.id, { subreddit: input.subreddit, url: input.url });
      await refreshRedditFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update Reddit sub");
    }
  }

  async function toggleRedditFeed(feed: RedditFeed) {
    setError(null);
    try {
      await updateRedditFeed(feed.id, { is_active: !feed.is_active });
      await refreshRedditFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update Reddit sub status");
    }
  }

  async function removeRedditFeed(feed: RedditFeed) {
    setError(null);
    try {
      await deleteRedditFeed(feed.id);
      await refreshRedditFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete Reddit sub");
    }
  }

  async function logout() {
    setError(null);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log out");
    }
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div>
          <div className="admin-brand">RSS Digest</div>
          {session?.user.email && <p className="admin-user">{session.user.email}</p>}
        </div>
        <nav>
          <a href="#sources">Sources</a>
          <a href="#runs">Recent Runs</a>
          <Link to="/digests">Public Web</Link>
        </nav>
        <button className="admin-logout" type="button" onClick={logout}>Log out</button>
      </aside>

      <section className="page-shell utility-page admin-page">
        <div className="page-kicker">Owner</div>
        <h1 className="page-title">Admin</h1>
        <p className="page-intro">Manage feeds and check digest health.</p>
        {error && <ErrorNotice message={error} />}

        <h2 id="sources">Sources</h2>
        <div className="source-tabs" role="tablist" aria-label="Source type">
          <button
            aria-controls="rss-feeds-panel"
            aria-selected={activeSourceTab === "feeds"}
            className={activeSourceTab === "feeds" ? "source-tab source-tab-active" : "source-tab"}
            id="rss-feeds-tab"
            onClick={() => setActiveSourceTab("feeds")}
            role="tab"
            type="button"
          >
            RSS Feeds
          </button>
          <button
            aria-controls="reddit-subs-panel"
            aria-selected={activeSourceTab === "reddit"}
            className={activeSourceTab === "reddit" ? "source-tab source-tab-active" : "source-tab"}
            id="reddit-subs-tab"
            onClick={() => setActiveSourceTab("reddit")}
            role="tab"
            type="button"
          >
            Reddit Subs
          </button>
        </div>

        {activeSourceTab === "feeds" ? (
          <div aria-labelledby="rss-feeds-tab" id="rss-feeds-panel" role="tabpanel">
            <FeedForm onSubmit={addFeed} />
            {feeds.length === 0
              ? <EmptyState title="No feeds" body="Add RSS feeds to create daily digests." />
              : <FeedList feeds={feeds} onToggle={toggleFeed} onDelete={removeFeed} onUpdate={saveFeed} />}
          </div>
        ) : (
          <div aria-labelledby="reddit-subs-tab" id="reddit-subs-panel" role="tabpanel">
            <RedditFeedForm onSubmit={addRedditFeed} />
            {redditFeeds.length === 0
              ? <EmptyState title="No Reddit subs" body="Add subreddit RSS feeds to summarize Reddit posts." />
              : (
                <RedditFeedList
                  feeds={redditFeeds}
                  onToggle={toggleRedditFeed}
                  onDelete={removeRedditFeed}
                  onUpdate={saveRedditFeed}
                />
              )}
          </div>
        )}

        <h2 id="runs">Recent Runs</h2>
        <div className="run-list">
          {runs.map((run) => (
            <div className="run-row" key={run.id}>
              <div>
                <strong>{run.run_date}</strong>
                <p>{run.selected_item_count} selected items, {run.failed_feed_count} failed feeds</p>
                {run.error && <p className="error-text">{run.error}</p>}
              </div>
              <RunStatusBadge status={run.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
