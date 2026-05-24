import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";

vi.mock("./api/digestsApi", () => ({
  listDigests: vi.fn().mockResolvedValue([]),
  getDigestMarkdown: vi.fn(),
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

describe("App", () => {
  it("redirects the root route to the digests page", async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/"]}
      >
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("No digests yet")).toBeInTheDocument();
  });
});
