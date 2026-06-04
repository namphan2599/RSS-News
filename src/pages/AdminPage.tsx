import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createFeed, deleteFeed, type Feed, listFeeds, updateFeed } from "../api/feedsApi";
import { listRecentRuns, type DigestRun } from "../api/runsApi";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { FeedForm } from "../components/FeedForm";
import { FeedList } from "../components/FeedList";
import { RunStatusBadge } from "../components/RunStatusBadge";

export function AdminPage() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refreshFeeds() {
    setFeeds(await listFeeds());
  }

  useEffect(() => {
    Promise.all([listFeeds(), listRecentRuns()])
      .then(([nextFeeds, nextRuns]) => {
        setFeeds(nextFeeds);
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
          <a href="#feeds">Feeds</a>
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

        <h2 id="feeds">Feeds</h2>
        <FeedForm onSubmit={addFeed} />
        {feeds.length === 0
          ? <EmptyState title="No feeds" body="Add RSS feeds to create daily digests." />
          : <FeedList feeds={feeds} onToggle={toggleFeed} onDelete={removeFeed} onUpdate={saveFeed} />}

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
