import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

const supabaseMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: supabaseMock,
  },
}));

function OtpButton() {
  const { signInWithOtp } = useAuth();

  return <button onClick={() => signInWithOtp("owner@example.com")}>Sign in</button>;
}

function GoogleButton() {
  const { signInWithGoogle } = useAuth();

  return <button onClick={() => signInWithGoogle()}>Google</button>;
}

describe("AuthProvider", () => {
  it("returns email auth redirects to the admin route", async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabaseMock.signInWithOtp.mockResolvedValue({ error: null });

    render(
      <AuthProvider>
        <OtpButton />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(supabaseMock.signInWithOtp).toHaveBeenCalledWith({
        email: "owner@example.com",
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
    });
  });

  it("returns Google auth redirects to the admin route", async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabaseMock.signInWithOAuth.mockResolvedValue({ error: null });

    render(
      <AuthProvider>
        <GoogleButton />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Google" }));

    await waitFor(() => {
      expect(supabaseMock.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/admin` },
      });
    });
  });
});
