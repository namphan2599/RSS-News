import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRedditPostSummaries, listRedditPostSummariesByDate } from "./redditPostsApi";

const mocks = vi.hoisted(() => {
  const limit = vi.fn();
  const order3 = vi.fn(() => ({ limit }));
  const order2 = vi.fn(() => ({ order: order3 }));
  const order1 = vi.fn(() => ({ order: order2 }));
  const eq = vi.fn(() => ({ order: order2 }));
  const select = vi.fn(() => ({ eq, order: order1 }));
  const fromTable = vi.fn(() => ({ select }));
  return { eq, fromTable, limit, order1, order2, order3, select };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.fromTable,
  },
}));

describe("listRedditPostSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches newest public Reddit post summaries", async () => {
    mocks.limit.mockResolvedValue({
      data: [{
        id: "post-1",
        summary_date: "2026-06-05",
        subreddit: "programming",
        title: "Reddit title",
        url: "https://www.reddit.com/r/programming/comments/abc123/title/",
        summary: "Tóm tắt tiếng Việt.",
        published_at: "2026-06-05T01:30:00.000Z",
        fetched_at: "2026-06-05T02:00:00.000Z",
      }],
      error: null,
    });

    await expect(listRedditPostSummaries(25)).resolves.toEqual([{
      id: "post-1",
      summary_date: "2026-06-05",
      subreddit: "programming",
      title: "Reddit title",
      url: "https://www.reddit.com/r/programming/comments/abc123/title/",
      summary: "Tóm tắt tiếng Việt.",
      published_at: "2026-06-05T01:30:00.000Z",
      fetched_at: "2026-06-05T02:00:00.000Z",
    }]);

    expect(mocks.fromTable).toHaveBeenCalledWith("public_reddit_post_summaries");
    expect(mocks.select).toHaveBeenCalledWith("id,summary_date,subreddit,title,url,summary,published_at,fetched_at");
    expect(mocks.order1).toHaveBeenCalledWith("summary_date", { ascending: false });
    expect(mocks.order2).toHaveBeenCalledWith("published_at", { ascending: false, nullsFirst: false });
    expect(mocks.order3).toHaveBeenCalledWith("fetched_at", { ascending: false });
    expect(mocks.limit).toHaveBeenCalledWith(25);
  });

  it("fetches Reddit post summaries for one summary date", async () => {
    mocks.limit.mockResolvedValue({
      data: [{
        id: "post-1",
        summary_date: "2026-06-05",
        subreddit: "programming",
        title: "Reddit title",
        url: "https://www.reddit.com/r/programming/comments/abc123/title/",
        summary: "Tóm tắt tiếng Việt.",
        published_at: "2026-06-05T01:30:00.000Z",
        fetched_at: "2026-06-05T02:00:00.000Z",
      }],
      error: null,
    });

    await expect(listRedditPostSummariesByDate("2026-06-05", 25)).resolves.toEqual([{
      id: "post-1",
      summary_date: "2026-06-05",
      subreddit: "programming",
      title: "Reddit title",
      url: "https://www.reddit.com/r/programming/comments/abc123/title/",
      summary: "Tóm tắt tiếng Việt.",
      published_at: "2026-06-05T01:30:00.000Z",
      fetched_at: "2026-06-05T02:00:00.000Z",
    }]);

    expect(mocks.fromTable).toHaveBeenCalledWith("public_reddit_post_summaries");
    expect(mocks.select).toHaveBeenCalledWith("id,summary_date,subreddit,title,url,summary,published_at,fetched_at");
    expect(mocks.eq).toHaveBeenCalledWith("summary_date", "2026-06-05");
    expect(mocks.order2).toHaveBeenCalledWith("published_at", { ascending: false, nullsFirst: false });
    expect(mocks.order3).toHaveBeenCalledWith("fetched_at", { ascending: false });
    expect(mocks.limit).toHaveBeenCalledWith(25);
  });
});
