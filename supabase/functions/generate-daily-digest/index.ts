import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getConfig } from "../_shared/config.ts";
import { formatDateInTimezone } from "../_shared/dates.ts";
import {
  DigestJobError,
  isValidDigestDate,
  runDigestJob,
} from "../_shared/digestJob.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleGenerateDailyDigest(request: Request) {
  const config = getConfig();
  const body = await request.json().catch(() => ({}));
  const targetDate = typeof body.date === "string"
    ? body.date
    : formatDateInTimezone(new Date(), config.timezone);

  if (!isValidDigestDate(targetDate)) {
    return jsonResponse({ error: "date must use YYYY-MM-DD" }, 400);
  }

  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );
  try {
    const result = await runDigestJob({ config, supabase, date: targetDate });
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof DigestJobError) {
      const body = error.runId
        ? { error: error.message, runId: error.runId }
        : { error: error.message };
      return jsonResponse(body, error.status);
    }

    return jsonResponse({ error: String(error) }, 500);
  }
}

if (import.meta.main) {
  Deno.serve(handleGenerateDailyDigest);
}
