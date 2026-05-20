import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function logEvent(
  supabase: SupabaseClient,
  level: "debug" | "info" | "warn" | "error",
  source: string,
  message: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("app_logs").insert({
    level,
    source,
    message,
    context,
  });

  if (error) {
    console.error("Failed to write app log", {
      level,
      source,
      message,
      context,
      error,
    });
  }
}
