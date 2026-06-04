import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { ErrorNotice } from "../components/ErrorNotice";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { loading, session, signInWithOtp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!loading && session) {
    return <Navigate to="/admin" replace />;
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

  async function onGoogleSignIn() {
    setError(null);
    setSent(false);
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start Google sign in";
      setError(message);
      setGoogleLoading(false);
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
        <button className="google-signin-button" type="button" onClick={onGoogleSignIn} disabled={googleLoading}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="#4285f4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.7z" />
            <path fill="#34a853" d="M12 23c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7C4.4 20.6 7.8 23 12 23z" />
            <path fill="#fbbc05" d="M6.2 14.6c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.9H2.7C2 9.3 1.6 10.8 1.6 12.6s.4 3.2 1.1 4.6l3.5-2.6z" />
            <path fill="#ea4335" d="M12 5.1c1.5 0 2.9.5 4 1.6l3-3C17.2 2 14.8 1 12 1 7.8 1 4.4 3.4 2.7 7.9l3.5 2.7C7 7.3 9.3 5.1 12 5.1z" />
          </svg>
          <span>{googleLoading ? "Opening Google..." : "Sign in with Google"}</span>
        </button>
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
