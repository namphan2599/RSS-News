import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRedditFeed, listRedditFeeds } from "./redditFeedsApi";

const mocks = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  const insert = vi.fn();
  const fromTable = vi.fn(() => ({ insert, select }));
  const getUser = vi.fn();
  return { fromTable, getUser, insert, order, select };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.fromTable,
  },
}));

describe("redditFeedsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null });
  });

  it("lists Reddit feeds from reddit_feeds", async () => {
    mocks.order.mockResolvedValue({
      data: [{
        id: "reddit-feed-1",
        owner_id: "owner-1",
        subreddit: "programming",
        url: "https://www.reddit.com/r/programming/.rss",
        is_active: true,
        last_fetched_at: null,
        last_error: null,
      }],
      error: null,
    });

    await expect(listRedditFeeds()).resolves.toHaveLength(1);

    expect(mocks.fromTable).toHaveBeenCalledWith("reddit_feeds");
    expect(mocks.select).toHaveBeenCalledWith("id,owner_id,subreddit,url,is_active,last_fetched_at,last_error");
    expect(mocks.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("creates Reddit feed with default RSS URL", async () => {
    mocks.insert.mockResolvedValue({ error: null });

    await createRedditFeed({ subreddit: "programming" });

    expect(mocks.fromTable).toHaveBeenCalledWith("reddit_feeds");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "owner-1",
      subreddit: "programming",
      url: "https://www.reddit.com/r/programming/.rss",
    });
  });
});
