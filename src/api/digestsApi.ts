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

export async function getDigestMarkdown(date: string): Promise<string> {
  const { data: digest, error: digestError } = await supabase
    .from("daily_digests")
    .select("storage_bucket,storage_path")
    .eq("digest_date", date)
    .single();
  if (digestError) throw digestError;

  const { data } = supabase.storage
    .from(digest.storage_bucket)
    .getPublicUrl(digest.storage_path);

  const response = await fetch(data.publicUrl);
  if (!response.ok) throw new Error(await response.text());

  return response.text();
}
