import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getDigest, type DailyDigest } from "../api/digestsApi";
import type { AppShellContext } from "../components/AppShell";
import { DigestViewer } from "../components/DigestViewer";
import { EmptyState } from "../components/EmptyState";
import { ErrorNotice } from "../components/ErrorNotice";

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
  const { selectedDigestDate } = useOutletContext<AppShellContext>();
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

    getDigest(selectedDigestDate)
      .then((nextDigest) => {
        if (!active) return;

        if (nextDigest) {
          setDigest(nextDigest);
        } else {
          setMissingDigest(true);
        }
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
  }, [selectedDigestDate]);

  const showDigest = !loading && !error && !missingDigest && digest;

  return (
    <section className="digest-page page-shell">
      {loading && <p className="loading-text">Loading digest...</p>}
      {error && <ErrorNotice message={error} />}
      {!loading && missingDigest && (
        <EmptyState title="No digest for this date" body={`No digest was generated for ${selectedDigestDate}.`} />
      )}
      {showDigest && (
        digest.summary ? (
          <>
            <h1 className="reader-title">{digest.title}</h1>
            <DigestViewer markdown={digest.summary} />
          </>
        ) : (
          <EmptyState title="No summary available" body="This digest does not have a stored summary." />
        )
      )}
    </section>
  );
}
