import { Link } from "react-router-dom";
import type { DailyDigest } from "../api/digestsApi";

export function DigestList({ digests }: { digests: DailyDigest[] }) {
  return (
    <div className="digest-list">
      {digests.map((digest) => (
        <Link className="digest-row" key={digest.id} to={`/digests/${digest.digest_date}`}>
          <div>
            <strong>{digest.title}</strong>
            <p>{digest.summary || "No summary saved."}</p>
          </div>
          <span>{digest.item_count} items</span>
        </Link>
      ))}
    </div>
  );
}
