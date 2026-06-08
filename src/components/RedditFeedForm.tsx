import { type FormEvent, useState } from "react";

export function RedditFeedForm({
  onSubmit,
}: {
  onSubmit: (input: { subreddit: string; url?: string }) => Promise<void>;
}) {
  const [subreddit, setSubreddit] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ subreddit, url });
      setSubreddit("");
      setUrl("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="feed-form reddit-feed-form" onSubmit={handleSubmit}>
      <input value={subreddit} onChange={(event) => setSubreddit(event.target.value)} placeholder="Subreddit" required />
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="RSS URL (optional)" />
      <button type="submit" disabled={saving}>
        {saving ? "Adding..." : "Add Reddit sub"}
      </button>
    </form>
  );
}
