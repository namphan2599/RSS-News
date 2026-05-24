import { type FormEvent, useState } from "react";

export function FeedForm({
  onSubmit,
}: {
  onSubmit: (input: { url: string; title?: string; category?: string }) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ url, title, category });
      setUrl("");
      setTitle("");
      setCategory("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="feed-form" onSubmit={handleSubmit}>
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="RSS URL" required />
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
      <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" />
      <button type="submit" disabled={saving}>
        {saving ? "Adding..." : "Add feed"}
      </button>
    </form>
  );
}
