import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getConfig } from "./config.ts";

const REQUIRED_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APP_OWNER_EMAIL: "owner@example.com",
  GEMINI_API_KEY: "gemini-key",
};

const OPTIONAL_ENV = [
  "APP_TIMEZONE",
  "AI_PROVIDER",
  "GEMINI_MODEL",
  "DIGEST_MAX_ITEMS",
  "DIGEST_MAX_ITEMS_PER_FEED",
  "DIGEST_DESCRIPTION_MAX_CHARS",
  "DIGEST_MAX_OUTPUT_TOKENS",
];

function withEnv(fn: () => void): void {
  const names = [...Object.keys(REQUIRED_ENV), ...OPTIONAL_ENV];
  const previous = new Map(names.map((name) => [name, Deno.env.get(name)]));
  try {
    for (const name of names) Deno.env.delete(name);
    for (const [name, value] of Object.entries(REQUIRED_ENV)) {
      Deno.env.set(name, value);
    }
    fn();
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

Deno.test("getConfig accepts bounded positive integer digest limits", () => {
  withEnv(() => {
    Deno.env.set("DIGEST_MAX_ITEMS", "100");
    Deno.env.set("DIGEST_MAX_ITEMS_PER_FEED", "10");
    Deno.env.set("DIGEST_DESCRIPTION_MAX_CHARS", "1000");
    Deno.env.set("DIGEST_MAX_OUTPUT_TOKENS", "4000");

    const config = getConfig();

    assertEquals(config.digestMaxItems, 100);
    assertEquals(config.digestMaxItemsPerFeed, 10);
    assertEquals(config.digestDescriptionMaxChars, 1000);
    assertEquals(config.digestMaxOutputTokens, 4000);
  });
});

Deno.test("getConfig rejects non-integer and out-of-range digest limits", () => {
  withEnv(() => {
    Deno.env.set("DIGEST_MAX_ITEMS", "1.5");
    assertThrows(
      () => getConfig(),
      Error,
      "DIGEST_MAX_ITEMS must be a positive integer",
    );
  });

  withEnv(() => {
    Deno.env.set("DIGEST_DESCRIPTION_MAX_CHARS", "0");
    assertThrows(
      () => getConfig(),
      Error,
      "DIGEST_DESCRIPTION_MAX_CHARS must be a positive integer",
    );
  });

  withEnv(() => {
    Deno.env.set("DIGEST_MAX_OUTPUT_TOKENS", "999999");
    assertThrows(
      () => getConfig(),
      Error,
      "DIGEST_MAX_OUTPUT_TOKENS must be at most",
    );
  });
});

Deno.test("getConfig validates supported AI provider early", () => {
  withEnv(() => {
    Deno.env.set("AI_PROVIDER", "openai");
    assertThrows(
      () => getConfig(),
      Error,
      "AI_PROVIDER must be one of: gemini",
    );
  });
});

Deno.test("getConfig does not require unused cron secret", () => {
  withEnv(() => {
    Deno.env.delete("CRON_SECRET");

    const config = getConfig();

    assertEquals(config.ownerEmail, "owner@example.com");
  });
});
