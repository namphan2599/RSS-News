export function RunStatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{status}</span>;
}
