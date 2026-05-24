export function ErrorNotice({ message }: { message: string }) {
  return <div className="notice notice-error">{message}</div>;
}
