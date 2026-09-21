import "server-only";
import {
  createHecomAdminClient,
  getHecomSupabaseConfig,
} from "@/lib/hecom/supabase.server";

/**
 * Crédito agencia según ficha Hecom (`credito_form_slug`).
 * Si Hecom no responde, devuelve false: el tope de prepago sigue activo.
 */
export async function isAgencyCreditCliente(
  hecomClienteIdRaw: string,
): Promise<boolean> {
  const hecomClienteId = String(hecomClienteIdRaw ?? "").trim();
  if (!hecomClienteId) return false;
  if (!getHecomSupabaseConfig().configured) return false;

  try {
    const hecom = createHecomAdminClient();
    const { data, error } = await hecom
      .from("clientes")
      .select("credito_form_slug")
      .eq("id", hecomClienteId)
      .maybeSingle<{ credito_form_slug: string | null }>();
    if (error || !data) return false;
    return Boolean(String(data.credito_form_slug ?? "").trim());
  } catch (error) {
    console.warn("[agency-credit] lookup_failed", {
      hecomClienteId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
