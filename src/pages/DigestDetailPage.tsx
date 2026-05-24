import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDigestMarkdown } from "../api/digestsApi";
import { DigestViewer } from "../components/DigestViewer";
import { ErrorNotice } from "../components/ErrorNotice";

export function DigestDetailPage() {
  const { date } = useParams();
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    getDigestMarkdown(date)
      .then(setMarkdown)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <section>
      <Link to="/digests" className="back-link">
        Back to digests
      </Link>
      {loading && <p>Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && <DigestViewer markdown={markdown} />}
    </section>
  );
}
