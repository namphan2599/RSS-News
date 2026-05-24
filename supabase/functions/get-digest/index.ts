import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getConfig } from "../_shared/config.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleGetDigest(request: Request): Promise<Response> {
  const config = getConfig();
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

  const userClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (
    userError || !userData.user ||
    userData.user.email?.toLowerCase() !== config.ownerEmail.toLowerCase()
  ) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({
      error: "Expected date query param in YYYY-MM-DD format",
    }, 400);
  }

  const { data: digest, error: digestError } = await serviceClient
    .from("daily_digests")
    .select("storage_bucket, storage_path")
    .eq("owner_id", userData.user.id)
    .eq("digest_date", date)
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
      "Cache-Control": "private, max-age=60",
    },
  });
}

if (import.meta.main) {
  Deno.serve(handleGetDigest);
}
