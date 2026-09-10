import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cliente que usa Ads Holistic (login OTP / cartera / pagos),
 * NO solo ficha Hecom con advertisers sincronizados por la agencia.
 *
 * Ej.: Ely Aguirre puede estar en Hecom + TikTok BM, pero sin user link ni
 * payment_intents → no es Ads Holistic → no le tocamos el cupo BM10/30.
 */
export async function isAdsHolisticCliente(
  hecomClienteIdRaw: string,
): Promise<boolean> {
  const hecomClienteId = String(hecomClienteIdRaw ?? "").trim();
  if (!hecomClienteId) return false;

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("hecom_cliente_user_links")
    .select("user_id")
    .eq("hecom_cliente_id", hecomClienteId)
    .limit(1)
    .maybeSingle<{ user_id: string }>();
  if (link?.user_id) return true;

  const { data: pi } = await admin
    .from("payment_intents")
    .select("id")
    .eq("metadata->>hecom_cliente_id", hecomClienteId)
    .eq("status", "succeeded")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return Boolean(pi?.id);
}
