import { createClient } from "@supabase/supabase-js";
import { requireFrontendEnv } from "./env";

const config = requireFrontendEnv();

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
