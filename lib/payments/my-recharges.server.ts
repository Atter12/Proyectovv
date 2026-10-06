import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortRecharges, toRechargeRow, type RechargeRow } from "./my-recharges.shared";

const WINDOW_DAYS = 30;
const LIMIT = 12;

/** Recargas del cliente en los últimos 30 días (las que hizo desde el panel). */
export async function listMyRecharges(input: {
  organizationId: string;
  hecomClienteId: string;
}): Promise<RechargeRow[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await createAdminClient()
    .from("payment_intents")
    .select("id,created_at,status,provider,amount_cents,currency,checkout_url,failure_reason,metadata")
    .eq("organization_id", input.organizationId)
    .eq("metadata->>hecom_cliente_id", input.hecomClienteId)
    .eq("metadata->>source", "dashboard")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    console.warn("[my-recharges] list_failed", { error: error.message });
    return [];
  }
  return sortRecharges((data ?? []).map(toRechargeRow));
}
