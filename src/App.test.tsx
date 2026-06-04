import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";

function NavigateButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>Navigate</button>;
}

const digestsApiMock = vi.hoisted(() => ({
  getDigest: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  session: { user: { email: "owner@example.com" } } as { user: { email: string } } | null,
  signOut: vi.fn(),
}));

vi.mock("./components/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: ReactElement }) => children,
}));

vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({
    loading: false,
    session: authMock.session,
    signInWithOtp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: authMock.signOut,
  }),
}));

vi.mock("./api/digestsApi", () => ({
  listDigests: vi.fn().mockResolvedValue([]),
  getDigest: digestsApiMock.getDigest,
}));

vi.mock("./api/feedsApi", () => ({
  createFeed: vi.fn(),
  deleteFeed: vi.fn(),
  listFeeds: vi.fn().mockResolvedValue([]),
  updateFeed: vi.fn(),
}));

vi.mock("./api/runsApi", () => ({
  listRecentRuns: vi.fn().mockResolvedValue([]),
}));

function mockDigest(date: string, summary: string | null = "## Programming\n\n- Daily updates.") {
  return {
    id: `digest-${date}`,
    digest_date: date,
    title: `Daily RSS Digest: ${date}`,
    summary,
    item_count: 3,
    generated_at: `${date}T12:00:00.000Z`,
  };
}

function mockSystemTheme(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function getDateInput(value: string) {
  return document.querySelector(`input[type="date"][value="${value}"]`);
}

describe("App", () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    mockSystemTheme(false);
    digestsApiMock.getDigest.mockReset();
    authMock.session = { user: { email: "owner@example.com" } };
    authMock.signOut.mockReset();
    authMock.signOut.mockImplementation(async () => {
      authMock.session = null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the root route on today's digest", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(getDateInput("2026-05-29")).toHaveValue("2026-05-29");
    expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-29");
    expect(screen.getByText("Daily briefing")).toBeInTheDocument();
    expect(screen.getByText("2026-05-29 · 3 items")).toBeInTheDocument();
  });

  it("does not show public navigation controls", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });

  it("renders the admin page at /admin", async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/admin"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("Manage feeds and check digest health.")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Admin navigation" })).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feeds" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent Runs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("logs out from the admin sidebar", async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/admin"]}
      >
        <App />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    await waitFor(() => expect(authMock.signOut).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("redirects old feed and settings routes to admin", async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/feeds"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
  });

  it("uses system dark theme when no stored theme exists", async () => {
    mockSystemTheme(true);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    const { container } = render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("toggles from light to dark theme and stores the choice", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    const { container } = render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "light");

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("uses stored dark theme before system light theme", async () => {
    localStorage.setItem("theme", "dark");
    mockSystemTheme(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(mockDigest("2026-05-29"));

    const { container } = render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("moves between selected dates with previous and next buttons", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockImplementation((date: string) => Promise.resolve(mockDigest(date)));

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-28" })).toBeInTheDocument();
    expect(getDateInput("2026-05-28")).toHaveValue("2026-05-28");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(getDateInput("2026-05-29")).toHaveValue("2026-05-29");
    expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-29");
    expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-28");
  });

  it("loads a digest selected with the date picker", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockImplementation((date: string) => Promise.resolve(mockDigest(date)));

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();

    fireEvent.change(getDateInput("2026-05-29")!, { target: { value: "2026-05-27" } });

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-27" })).toBeInTheDocument();
    expect(getDateInput("2026-05-27")).toHaveValue("2026-05-27");
    expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-27");
  });

  it("renders a missing digest empty state for no-row digest responses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockResolvedValue(null);

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("No digest for this date")).toBeInTheDocument();
    expect(screen.getByText("No digest was generated for 2026-05-29.")).toBeInTheDocument();
  });

  it("renders the digest summary for a digest detail route", async () => {
    digestsApiMock.getDigest.mockResolvedValue({
      id: "digest-1",
      digest_date: "2026-05-29",
      title: "Daily RSS Digest: 2026-05-29",
      summary: "## Programming\n\n- Programming updates for the day.",
      item_count: 3,
      generated_at: "2026-05-29T12:00:00.000Z",
    });

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/digests/2026-05-29"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(screen.getByText("2026-05-29")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Programming" })).toBeInTheDocument();
    expect(screen.getByText("Programming updates for the day.")).toBeInTheDocument();
    expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-29");
  });

  it("ignores stale digest responses after navigating to a different date", async () => {
    let resolveOldDigest: (value: unknown) => void = () => {};
    digestsApiMock.getDigest.mockImplementation((date: string) => {
      if (date === "2026-05-29") {
        return new Promise((resolve) => {
          resolveOldDigest = resolve;
        });
      }

      return Promise.resolve({
        id: "digest-2",
        digest_date: "2026-05-30",
        title: "Daily RSS Digest: 2026-05-30",
        summary: "New digest summary.",
        item_count: 2,
        generated_at: "2026-05-30T12:00:00.000Z",
      });
    });

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/digests/2026-05-29"]}
      >
        <NavigateButton to="/digests/2026-05-30" />
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-29"));
    fireEvent.click(screen.getByRole("button", { name: "Navigate" }));

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-30" })).toBeInTheDocument();

    resolveOldDigest({
      id: "digest-1",
      digest_date: "2026-05-29",
      title: "Daily RSS Digest: 2026-05-29",
      summary: "Stale digest summary.",
      item_count: 1,
      generated_at: "2026-05-29T12:00:00.000Z",
    });

    await waitFor(() => expect(screen.queryByText("Stale digest summary.")).not.toBeInTheDocument());
    expect(screen.getByText("New digest summary.")).toBeInTheDocument();
  });

  it("renders an empty state when a digest summary is missing", async () => {
    digestsApiMock.getDigest.mockResolvedValue({
      id: "digest-1",
      digest_date: "2026-05-29",
      title: "Daily RSS Digest: 2026-05-29",
      summary: null,
      item_count: 0,
      generated_at: "2026-05-29T12:00:00.000Z",
    });

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/digests/2026-05-29"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("No summary available")).toBeInTheDocument();
    expect(screen.getByText("This digest does not have a stored summary.")).toBeInTheDocument();
  });
});
