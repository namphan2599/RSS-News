import { supabase } from "../lib/supabaseClient";

export type DigestRun = {
  id: string;
  run_date: string;
  status: "running" | "succeeded" | "failed" | "partial";
  started_at: string;
  finished_at: string | null;
  feed_count: number;
  failed_feed_count: number;
  selected_item_count: number;
  error: string | null;
};

export async function listRecentRuns(): Promise<DigestRun[]> {
  const { data, error } = await supabase
    .from("digest_runs")
    .select(
      "id,run_date,status,started_at,finished_at,feed_count,failed_feed_count,selected_item_count,error",
    )
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}
