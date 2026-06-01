import { useEffect, useState } from "react";
import { getDigest, type DailyDigest } from "../api/digestsApi";
import { DatePicker } from "../components/DatePicker";
import { DigestViewer } from "../components/DigestViewer";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return formatDate(date);
}

function isMissingDigestError(error: unknown) {
  if (error instanceof Error) return error.message.includes("no) rows returned");
  if (typeof error !== "object" || error === null) return false;

  const maybeError = error as { code?: unknown; message?: unknown };
  return maybeError.code === "PGRST116" || maybeError.message === "JSON object requested, multiple (or no) rows returned";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load digest.";
}

export function DigestsPage() {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingDigest, setMissingDigest] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);
    setDigest(null);
    setMissingDigest(false);

    getDigest(selectedDate)
      .then((nextDigest) => {
        if (active) setDigest(nextDigest);
      })
      .catch((err) => {
        if (!active) return;

        if (isMissingDigestError(err)) {
          setMissingDigest(true);
        } else {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const showDigest = !loading && !error && !missingDigest && digest;

  return (
    <section className="digest-page page-shell">
      <div className="page-kicker">Daily briefing</div>
      <h1 className="page-title">Daily RSS Digest</h1>
      <p className="page-intro">A focused reader for the selected day's feed summary.</p>

      <div className="digest-toolbar" aria-label="Digest date controls">
        <button type="button" onClick={() => setSelectedDate((value) => shiftDate(value, -1))}>
          Previous
        </button>
        <button type="button" onClick={() => setSelectedDate((value) => shiftDate(value, 1))}>
          Next
        </button>
        <DatePicker value={selectedDate} onChange={(value) => value && setSelectedDate(value)} />
      </div>

      {loading && <p className="loading-text">Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && missingDigest && (
        <EmptyState title="No digest for this date" body={`No digest was generated for ${selectedDate}.`} />
      )}
      {showDigest && (
        <article className="digest-article">
          <header className="digest-header">
            <p className="digest-meta">
              {digest.digest_date} · {digest.item_count} {digest.item_count === 1 ? "item" : "items"}
            </p>
            <h2>{digest.title}</h2>
          </header>
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
