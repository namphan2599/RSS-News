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
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Sign in before reading digests");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-digest?date=${
      encodeURIComponent(date)
    }`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}
