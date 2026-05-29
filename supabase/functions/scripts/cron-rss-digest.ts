import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getConfig } from "../_shared/config.ts";
import { isValidDigestDate, runDigestJob } from "../_shared/digestJob.ts";

type CronDigestArgs = {
  date?: string;
};

export function parseCronDigestArgs(args: string[]): CronDigestArgs {
  const parsed: CronDigestArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg !== "--date") {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const date = args[index + 1];
    if (!date || !isValidDigestDate(date)) {
      throw new Error("--date must use YYYY-MM-DD");
    }

    parsed.date = date;
    index += 1;
  }

  return parsed;
}

export async function main(args: string[] = Deno.args): Promise<void> {
  const { date } = parseCronDigestArgs(args);
  const config = getConfig();
  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  );
  const result = await runDigestJob({ config, supabase, date });
  console.log(JSON.stringify(result));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    Deno.exit(1);
  });
}
