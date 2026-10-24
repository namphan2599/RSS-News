import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function RequireAuth({ children }: { children: ReactElement }) {
  const { loading, session } = useAuth();

  if (loading) {
    return <p>Checking session...</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
