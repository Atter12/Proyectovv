import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Cliente con service role — solo para operaciones server-side sensibles
 * (wallet_transactions, payment_intents, etc.). Nunca importar en cliente.
 */
export function createAdminClient() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) {
    throw new Error(
      "[supabase/admin] SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios.",
    );
  }

  return createClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
