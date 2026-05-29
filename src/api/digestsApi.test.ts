import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDigestMarkdown } from "./digestsApi";

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const fromTable = vi.fn(() => ({ select }));
  const getPublicUrl = vi.fn();
  const fetch = vi.fn();
  const fromStorage = vi.fn(() => ({ getPublicUrl }));

  return { eq, fetch, fromStorage, fromTable, getPublicUrl, select, single };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.fromTable,
    storage: {
      from: mocks.fromStorage,
    },
  },
}));

describe("getDigestMarkdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("fetches markdown from the digest public storage URL", async () => {
    mocks.single.mockResolvedValue({
      data: {
        storage_bucket: "digests",
        storage_path: "daily/2026/05/2026-05-29.md",
      },
      error: null,
    });
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/digests/daily/2026/05/2026-05-29.md" },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("# Daily Digest"),
    });

    await expect(getDigestMarkdown("2026-05-29")).resolves.toBe("# Daily Digest");

    expect(mocks.fromTable).toHaveBeenCalledWith("daily_digests");
    expect(mocks.select).toHaveBeenCalledWith("storage_bucket,storage_path");
    expect(mocks.eq).toHaveBeenCalledWith("digest_date", "2026-05-29");
    expect(mocks.fromStorage).toHaveBeenCalledWith("digests");
    expect(mocks.getPublicUrl).toHaveBeenCalledWith("daily/2026/05/2026-05-29.md");
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/storage/v1/object/public/digests/daily/2026/05/2026-05-29.md",
    );
  });
});
