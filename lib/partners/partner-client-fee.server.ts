import "server-only";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";

/**
 * Fee preferencial de una alianza: deja al cliente con ese % en Hecom (ficha y
 * todas sus cuentas TikTok). Ads Holistic cobra las recargas con ese fee.
 * Nunca lanza: si falla, avisa en el log y devuelve false.
 */
export async function applyPartnerClientFee(input: {
  hecomClienteIds: string[];
  feePercent: number | null | undefined;
}): Promise<boolean> {
  const raw = Number(input.feePercent);
  // Se guarda ya en % (3 = 3 %); no se reinterpreta 0.5 como fracción.
  const fee = input.feePercent != null && Number.isFinite(raw) && raw >= 0 && raw <= 50 ? Math.round(raw * 100) / 100 : null;
  const ids = [...new Set(input.hecomClienteIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (fee == null || ids.length === 0) return true;
  try {
    const hecom = createHecomAdminClient();
    const [clientes, cuentas] = await Promise.all([
      hecom.from("clientes").update({ tiktok_default_fee: fee }).in("id", ids),
      hecom.from("cliente_tiktok_cuentas").update({ fee }).in("client_id", ids),
    ]);
    const error = clientes.error ?? cuentas.error;
    if (error) {
      console.warn("[partners] client_fee_failed", { ids, fee, error: error.message });
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[partners] client_fee_failed", { ids, fee, error });
    return false;
  }
}
