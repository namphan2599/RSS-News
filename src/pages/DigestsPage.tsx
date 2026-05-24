import { useEffect, useState } from "react";
import { type DailyDigest, listDigests } from "../api/digestsApi";
import { DigestList } from "../components/DigestList";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";

export function DigestsPage() {
  const [digests, setDigests] = useState<DailyDigest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDigests()
      .then(setDigests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading digests...</p>;
  if (error) return <ErrorNotice message={error} />;
  if (digests.length === 0) {
    return <EmptyState title="No digests yet" body="Add feeds, then run daily generation." />;
  }

  return (
    <section>
      <h1>Daily Digests</h1>
      <DigestList digests={digests} />
    </section>
  );
}
