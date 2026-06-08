import { supabase } from "../lib/supabaseClient";

export type RedditFeed = {
  id: string;
  owner_id: string;
  subreddit: string;
  url: string;
  is_active: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
};

function redditRssUrl(subreddit: string): string {
  return `https://www.reddit.com/r/${subreddit.trim()}/.rss`;
}

export async function listRedditFeeds(): Promise<RedditFeed[]> {
  const { data, error } = await supabase
    .from("reddit_feeds")
    .select("id,owner_id,subreddit,url,is_active,last_fetched_at,last_error")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createRedditFeed(input: { subreddit: string; url?: string }): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in before adding Reddit subs");

  const subreddit = input.subreddit.trim();
  const { error } = await supabase.from("reddit_feeds").insert({
    owner_id: userData.user.id,
    subreddit,
    url: input.url?.trim() || redditRssUrl(subreddit),
  });
  if (error) throw error;
}

export async function updateRedditFeed(
  id: string,
  input: Partial<Pick<RedditFeed, "subreddit" | "url" | "is_active">>,
): Promise<void> {
  const nextInput = {
    ...input,
    subreddit: input.subreddit?.trim(),
    url: input.url?.trim(),
  };
  const { error } = await supabase.from("reddit_feeds").update(nextInput).eq("id", id);
  if (error) throw error;
}

export async function deleteRedditFeed(id: string): Promise<void> {
  const { error } = await supabase.from("reddit_feeds").delete().eq("id", id);
  if (error) throw error;
}
