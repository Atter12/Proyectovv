import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Hecom Club CRM lives on its own Supabase project (table `clientes`).
 * Default URL is the known Holistic/Hecom project; service role must be set
 * via HECOM_SUPABASE_SERVICE_ROLE_KEY (or shared SUPABASE_SERVICE_ROLE_KEY
 * only if Ecomdy points at the same project).
 */
export function getHecomSupabaseConfig(): {
  url: string;
  serviceRoleKey: string;
  configured: boolean;
} {
  const url =
    process.env.HECOM_SUPABASE_URL?.trim() ||
    process.env.PUBLIC_SUPABASE_URL?.trim() ||
    // Known Hecom Club / Holistic Supabase project (from hecom.club backups/docs)
    "https://fsnolvozwcnbyuradiru.supabase.co";

  const serviceRoleKey =
    process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    // Only reuse Ecomdy service role if explicitly allowed or same host
    (serverEnv.supabaseUrl.includes("fsnolvozwcnbyuradiru")
      ? serverEnv.supabaseServiceRoleKey
      : "") ||
    "";

  return {
    url,
    serviceRoleKey,
    configured: Boolean(url && serviceRoleKey),
  };
}

export function createHecomAdminClient(): SupabaseClient {
  const cfg = getHecomSupabaseConfig();
  if (!cfg.serviceRoleKey) {
    throw new Error(
      "[hecom] Falta HECOM_SUPABASE_SERVICE_ROLE_KEY. En Vercel agregá la service role del proyecto Hecom Club (fsnolvozwcnbyuradiru).",
    );
  }
  return createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
