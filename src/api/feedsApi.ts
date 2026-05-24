import { supabase } from "../lib/supabaseClient";

export type Feed = {
  id: string;
  owner_id: string;
  title: string | null;
  url: string;
  site_url: string | null;
  category: string | null;
  is_active: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
};

export async function listFeeds(): Promise<Feed[]> {
  const { data, error } = await supabase
    .from("feeds")
    .select("id,owner_id,title,url,site_url,category,is_active,last_fetched_at,last_error")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFeed(input: {
  url: string;
  title?: string;
  category?: string;
}): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in before adding feeds");
  const { error } = await supabase.from("feeds").insert({
    owner_id: userData.user.id,
    url: input.url,
    title: input.title || null,
    category: input.category || null,
  });
  if (error) throw error;
}

export async function updateFeed(
  id: string,
  input: Partial<Pick<Feed, "title" | "category" | "is_active">>,
): Promise<void> {
  const { error } = await supabase.from("feeds").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteFeed(id: string): Promise<void> {
  const { error } = await supabase.from("feeds").delete().eq("id", id);
  if (error) throw error;
}
