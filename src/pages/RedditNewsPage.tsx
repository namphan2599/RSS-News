import { useOutletContext } from "react-router-dom";
import type { AppShellContext } from "../components/AppShell";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

function formatPublishedTime(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RedditNewsPage() {
  const {
    redditPosts,
    selectedRedditDate,
    selectedRedditPost: selectedPost,
    redditError: error,
    redditLoading: loading,
  } = useOutletContext<AppShellContext>();
  const selectedPublishedTime = selectedPost ? formatPublishedTime(selectedPost.published_at) : null;

  return (
    <section className="reddit-page page-shell">
      {loading && <p className="loading-text">Loading Reddit news...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && redditPosts.length === 0 && (
        <EmptyState title="No Reddit posts" body={`No Reddit post summaries have been saved for ${selectedRedditDate}.`} />
      )}
      {!loading && !error && selectedPost && (
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
      )}
    </section>
  );
}
