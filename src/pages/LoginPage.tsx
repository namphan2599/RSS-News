import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { ErrorNotice } from "../components/ErrorNotice";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { loading, session, signInWithOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!loading && session) {
    return <Navigate to="/digests" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSent(false);

    try {
      await signInWithOtp(email.trim());
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send login link";
      setError(message);
    }
  }

  return (
    <section className="login-wrap">
      <div className="login-card">
        <div className="page-kicker">Private briefing</div>
        <h1 className="page-title">Sign in</h1>
        <p>Use the owner email configured in Supabase to manage feeds and read digests.</p>
        {error && <ErrorNotice message={error} />}
        {sent && (
          <div className="notice">
            Magic link sent. Open your email and continue from the login link.
          </div>
        )}
        <form className="login-form" onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit">Send magic link</button>
        </form>
      </div>
    </section>
  );
}
