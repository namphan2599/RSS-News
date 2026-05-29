import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDigest, type DailyDigest } from "../api/digestsApi";
import { DigestViewer } from "../components/DigestViewer";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";

export function DigestDetailPage() {
  const { date } = useParams();
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    let active = true;

    setLoading(true);
    setError(null);
    setDigest(null);

    getDigest(date)
      .then((nextDigest) => {
        if (active) setDigest(nextDigest);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  return (
    <section>
      <Link to="/digests" className="back-link">
        Back to digests
      </Link>
      {loading && <p>Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && digest && (
        <article>
          <h1>{digest.title}</h1>
          <p>{digest.digest_date}</p>
          {digest.summary ? (
            <DigestViewer markdown={digest.summary} />
          ) : (
            <EmptyState title="No summary available" body="This digest does not have a stored summary." />
          )}
        </article>
      )}
    </section>
  );
}
