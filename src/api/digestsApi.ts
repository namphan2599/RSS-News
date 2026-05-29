import { supabase } from "../lib/supabaseClient";

export type DailyDigest = {
  id: string;
  digest_date: string;
  title: string;
  summary: string | null;
  item_count: number;
  generated_at: string;
};

export async function listDigests(): Promise<DailyDigest[]> {
  const { data, error } = await supabase
    .from("daily_digests")
    .select("id,digest_date,title,summary,item_count,generated_at")
    .order("digest_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDigest(date: string): Promise<DailyDigest> {
  const { data, error } = await supabase
    .from("daily_digests")
    .select("id,digest_date,title,summary,item_count,generated_at")
    .eq("digest_date", date)
    .single();
  if (error) throw error;
  return data;
}
