import { supabase } from "../lib/supabaseClient";

export type RedditPostSummary = {
  id: string;
  summary_date: string;
  subreddit: string;
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  fetched_at: string;
};

export async function listRedditPostSummaries(limit = 50): Promise<RedditPostSummary[]> {
  const { data, error } = await supabase
    .from("public_reddit_post_summaries")
    .select("id,summary_date,subreddit,title,url,summary,published_at,fetched_at")
    .order("summary_date", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listRedditPostSummariesByDate(date: string, limit = 50): Promise<RedditPostSummary[]> {
  const { data, error } = await supabase
    .from("public_reddit_post_summaries")
    .select("id,summary_date,subreddit,title,url,summary,published_at,fetched_at")
    .eq("summary_date", date)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
