import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Dirección del cliente (tabla hecom_cliente_direcciones). Obligatoria desde el registro
 * para poder armar la carta notarial y el expediente de cobranza (pedido de gerencia 13/10/2026).
 * Nunca frena el registro: si falla, la dirección igual quedó en las notas de Hecom.
 */
export async function saveHecomClienteAddress(input: {
  hecomClienteId: string;
  email: string;
  address: string;
  country?: string | null;
}): Promise<void> {
  const address = input.address.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!input.hecomClienteId || address.length < 8) return;
  try {
    const { error } = await createAdminClient()
      .from("hecom_cliente_direcciones")
      .upsert(
        {
          hecom_cliente_id: input.hecomClienteId,
          email: input.email.trim().toLowerCase(),
          address,
          country: input.country ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "hecom_cliente_id" },
      );
    if (error) console.warn("[cliente-direccion] save_failed", { message: error.message });
  } catch (error) {
    console.warn("[cliente-direccion] save_failed", { message: error instanceof Error ? error.message : String(error) });
  }
}

export async function getHecomClienteAddress(hecomClienteId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("hecom_cliente_direcciones")
    .select("address")
    .eq("hecom_cliente_id", hecomClienteId)
    .maybeSingle<{ address: string }>();
  return data?.address ?? null;
}
