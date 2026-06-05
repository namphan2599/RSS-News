import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRedditPostSummaries, type RedditPostSummary } from "../api/redditPostsApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load Reddit news.";
}

function formatPublishedTime(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RedditNewsPage() {
  const [posts, setPosts] = useState<RedditPostSummary[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    listRedditPostSummaries()
      .then((nextPosts) => {
        if (!active) return;
        setPosts(nextPosts);
        setSelectedPostId(nextPosts[0]?.id ?? null);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? posts[0] ?? null;
  const selectedPublishedTime = selectedPost ? formatPublishedTime(selectedPost.published_at) : null;

  return (
    <section className="reddit-page page-shell">
      <Link className="back-link" to="/digests">Back to Daily Digest</Link>
      <div className="page-kicker">Reddit briefing</div>
      <h1 className="page-title">Reddit News</h1>
      <p className="page-intro">Vietnamese summaries from configured Reddit RSS feeds.</p>

      {loading && <p className="loading-text">Loading Reddit news...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && posts.length === 0 && (
        <EmptyState title="No Reddit posts" body="No Reddit post summaries have been saved yet." />
      )}
      {!loading && !error && selectedPost && (
        <div className="reddit-reader">
          <aside className="reddit-sidebar" aria-label="Reddit posts">
            <h2>Posts</h2>
            <div className="reddit-post-list">
              {posts.map((post) => {
                const publishedTime = formatPublishedTime(post.published_at);
                const selected = post.id === selectedPost.id;

                return (
                  <button
                    aria-pressed={selected}
                    className={`reddit-post-item${selected ? " is-selected" : ""}`}
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    type="button"
                  >
                    <span className="reddit-card-meta">
                      <span className="reddit-subreddit">r/{post.subreddit}</span>
                      <span>{post.summary_date}</span>
                    </span>
                    <span className="reddit-post-title">{post.title}</span>
                    {publishedTime && <span className="reddit-post-time">{publishedTime}</span>}
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="reddit-summary-panel">
            <div className="reddit-summary-header">
              <div className="reddit-card-meta">
                <span className="reddit-subreddit">r/{selectedPost.subreddit}</span>
                <span>{selectedPost.summary_date}</span>
                {selectedPublishedTime && <span>{selectedPublishedTime}</span>}
              </div>
              <h2>{selectedPost.title}</h2>
              <a href={selectedPost.url} target="_blank" rel="noreferrer">Open Reddit post</a>
            </div>
            <MarkdownRenderer markdown={selectedPost.summary} />
          </article>
        </div>
      )}
    </section>
  );
}
