import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Hono } from "hono";
import { getConfig, type AppConfig } from "../_shared/config.ts";

type GetDigestDependencies = {
  getConfig: () => AppConfig;
  createClient: typeof createClient;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidDate(date: string | null): date is string {
  return Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));
}

export function createGetDigestApp(deps: GetDigestDependencies): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const config = deps.getConfig();
    const date = c.req.query("date");
    if (!isValidDate(date)) {
      return jsonResponse({
        error: "Expected date query param in YYYY-MM-DD format",
      }, 400);
    }

    const serviceClient = deps.createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
    );

    const { data: digest, error: digestError } = await serviceClient
      .from("daily_digests")
      .select("storage_bucket, storage_path")
      .eq("digest_date", date)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (digestError) return jsonResponse({ error: digestError.message }, 500);
    if (!digest) return jsonResponse({ error: "Digest not found" }, 404);

    const { data: file, error: fileError } = await serviceClient.storage
      .from(digest.storage_bucket)
      .download(digest.storage_path);

    if (fileError) return jsonResponse({ error: fileError.message }, 500);

    return new Response(await file.text(), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  });

  return app;
}

export const app = createGetDigestApp({ getConfig, createClient });

export function handleGetDigest(request: Request): Promise<Response> {
  return app.fetch(request);
}

if (import.meta.main) {
  Deno.serve(app.fetch);
}
