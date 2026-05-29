export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  ownerEmail: string;
  timezone: string;
  aiProvider: string;
  geminiModel: string;
  geminiApiKey: string;
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

function positiveIntegerEnv(
  name: string,
  fallback: number,
  max: number,
): number {
  const value = Deno.env.get(name);
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  if (parsed > max) {
    throw new Error(`${name} must be at most ${max}`);
  }
  return parsed;
}

export function getConfig(): AppConfig {
  const aiProvider = Deno.env.get("AI_PROVIDER") ?? "gemini";
  if (aiProvider !== "gemini") {
    throw new Error("AI_PROVIDER must be one of: gemini");
  }

  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: required("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    ownerEmail: required("APP_OWNER_EMAIL"),
    timezone: Deno.env.get("APP_TIMEZONE") ?? "Asia/Saigon",
    aiProvider,
    geminiModel: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash",
    geminiApiKey: required("GEMINI_API_KEY"),
    digestMaxItems: positiveIntegerEnv("DIGEST_MAX_ITEMS", 60, 500),
    digestMaxItemsPerFeed: positiveIntegerEnv(
      "DIGEST_MAX_ITEMS_PER_FEED",
      8,
      100,
    ),
    digestDescriptionMaxChars: positiveIntegerEnv(
      "DIGEST_DESCRIPTION_MAX_CHARS",
      500,
      5000,
    ),
    digestMaxOutputTokens: positiveIntegerEnv(
      "DIGEST_MAX_OUTPUT_TOKENS",
      2500,
      32000,
    ),
  };
}
