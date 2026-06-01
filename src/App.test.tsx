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

vi.mock("./components/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: ReactElement }) => children,
}));

vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({
    loading: false,
    session: { user: { email: "owner@example.com" } },
    signInWithOtp: vi.fn(),
    signOut: vi.fn(),
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

describe("App", () => {
  beforeEach(() => {
    vi.useRealTimers();
    digestsApiMock.getDigest.mockReset();
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
    expect(screen.getByLabelText("Date")).toHaveValue("2026-05-29");
    expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-29");
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
    expect(screen.getByLabelText("Date")).toHaveValue("2026-05-28");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-29" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-05-29");
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

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-05-27" } });

    expect(await screen.findByRole("heading", { name: "Daily RSS Digest: 2026-05-27" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-05-27");
    expect(digestsApiMock.getDigest).toHaveBeenCalledWith("2026-05-27");
  });

  it("renders a missing digest empty state for no-row digest responses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-29T08:00:00"));
    digestsApiMock.getDigest.mockRejectedValue({ code: "PGRST116", message: "Results contain 0 rows" });

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
