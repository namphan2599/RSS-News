import { useEffect, useState } from "react";
import { listRecentRuns, type DigestRun } from "../api/runsApi";
import { ErrorNotice } from "../components/ErrorNotice";
import { RunStatusBadge } from "../components/RunStatusBadge";

export function SettingsPage() {
  const [runs, setRuns] = useState<DigestRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecentRuns()
      .then(setRuns)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h1>Settings</h1>
      <div className="settings-panel">
        <p>Daily generation runs at 07:00 Asia/Saigon when Supabase Cron is configured.</p>
        <p>AI provider: Gemini</p>
      </div>
      <h2>Recent Runs</h2>
      {error && <ErrorNotice message={error} />}
      <div className="run-list">
        {runs.map((run) => (
          <div className="run-row" key={run.id}>
            <div>
              <strong>{run.run_date}</strong>
              <p>
                {run.selected_item_count} selected items, {run.failed_feed_count} failed feeds
              </p>
              {run.error && <p className="error-text">{run.error}</p>}
            </div>
            <RunStatusBadge status={run.status} />
          </div>
        ))}
      </div>
    </section>
  );
}
