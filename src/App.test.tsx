import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";

vi.mock("./api/digestsApi", () => ({
  listDigests: vi.fn().mockResolvedValue([]),
  getDigestMarkdown: vi.fn(),
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
