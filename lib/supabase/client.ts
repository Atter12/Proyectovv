import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env/env.client";
import { getSupabaseConfigError } from "@/lib/env/validate-supabase-config";

export function createClient() {
  const configError = getSupabaseConfigError(
    clientEnv.supabaseUrl,
    clientEnv.supabaseAnonKey,
  );
  if (configError) {
    throw new Error(configError);
  }

  return createBrowserClient(
    clientEnv.supabaseUrl.trim(),
    clientEnv.supabaseAnonKey.trim(),
  );
}
