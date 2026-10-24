import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createGetDigestApp } from "./index.ts";

const testConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
  supabaseServiceRoleKey: "service-role-key",
  ownerEmail: "owner@example.com",
  timezone: "Asia/Saigon",
  aiProvider: "gemini",
  geminiModel: "gemini-2.0-flash",
  geminiApiKey: "gemini-key",
  cronSecret: "cron-secret",
  digestMaxItems: 60,
  digestMaxItemsPerFeed: 8,
  digestDescriptionMaxChars: 500,
  digestMaxOutputTokens: 2500,
};

Deno.test("get-digest returns markdown without authorization", async () => {
  const app = createGetDigestApp({
    getConfig: () => testConfig,
    createClient: (() => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({
                  data: {
                    storage_bucket: "digests",
                    storage_path: "2026-05-27.md",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          download: () => Promise.resolve({
            data: new Blob(["# Digest"]),
            error: null,
          }),
        }),
      },
    })) as never,
  });

  const response = await app.request("http://localhost/?date=2026-05-27");

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "text/markdown; charset=utf-8",
  );
  assertEquals(await response.text(), "# Digest");
});

Deno.test("get-digest rejects invalid date", async () => {
  const app = createGetDigestApp({
    getConfig: () => testConfig,
    createClient: (() => {
      throw new Error("client should not be created for invalid date");
    }) as never,
  });

  const response = await app.request("http://localhost/?date=bad-date");

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: "Expected date query param in YYYY-MM-DD format",
  });
});
