export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  ownerEmail: string;
  timezone: string;
  aiProvider: string;
  geminiModel: string;
  geminiApiKey: string;
  cronSecret: string;
  digestMaxItems: number;
  digestMaxItemsPerFeed: number;
  digestDescriptionMaxChars: number;
  digestMaxOutputTokens: number;
};

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const value = Deno.env.get(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric environment variable: ${name}`);
  return parsed;
}

export function getConfig(): AppConfig {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    ownerEmail: required("APP_OWNER_EMAIL"),
    timezone: Deno.env.get("APP_TIMEZONE") ?? "Asia/Saigon",
    aiProvider: Deno.env.get("AI_PROVIDER") ?? "gemini",
    geminiModel: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash",
    geminiApiKey: required("GEMINI_API_KEY"),
    cronSecret: required("CRON_SECRET"),
    digestMaxItems: numberEnv("DIGEST_MAX_ITEMS", 60),
    digestMaxItemsPerFeed: numberEnv("DIGEST_MAX_ITEMS_PER_FEED", 8),
    digestDescriptionMaxChars: numberEnv("DIGEST_DESCRIPTION_MAX_CHARS", 500),
    digestMaxOutputTokens: numberEnv("DIGEST_MAX_OUTPUT_TOKENS", 2500),
  };
}
