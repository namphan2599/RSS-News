import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDigest } from "./digestsApi";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const fromTable = vi.fn(() => ({ select }));

  return { eq, fromTable, maybeSingle, select };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.fromTable,
  },
}));

describe("getDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a digest summary by date", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "digest-1",
        digest_date: "2026-05-29",
        title: "Daily RSS Digest: 2026-05-29",
        summary: "Programming\n- Dev updates.",
        item_count: 2,
        generated_at: "2026-05-29T12:00:00.000Z",
      },
      error: null,
    });

    await expect(getDigest("2026-05-29")).resolves.toEqual({
      id: "digest-1",
      digest_date: "2026-05-29",
      title: "Daily RSS Digest: 2026-05-29",
      summary: "Programming\n- Dev updates.",
      item_count: 2,
      generated_at: "2026-05-29T12:00:00.000Z",
    });

    expect(mocks.fromTable).toHaveBeenCalledWith("daily_digests");
    expect(mocks.select).toHaveBeenCalledWith("id,digest_date,title,summary,item_count,generated_at");
    expect(mocks.eq).toHaveBeenCalledWith("digest_date", "2026-05-29");
  });

  it("returns null when no digest exists for the date", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getDigest("2026-05-30")).resolves.toBeNull();
  });
});
