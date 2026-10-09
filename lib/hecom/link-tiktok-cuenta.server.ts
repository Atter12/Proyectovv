import "server-only";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { DEFAULT_DEPOSIT_FEE_PERCENT, normalizeFeePercent } from "@/lib/payments/deposit-fee";
import { resolveTikTokSelfServeUncountedAdvertisers } from "@/lib/integrations/tiktok/bc-create-profiles";

export type LinkTikTokCuentaInput = {
  clientId: string;
  advertiserId: string;
  advertiserName: string;
  bmBucket: string;
  fee?: number | null;
  syncEnabled?: boolean;
};

export type LinkTikTokCuentaResult = {
  id: string;
  advertiserId: string;
  alreadyExisted: boolean;
};

/**
 * Cuenta filas mapeadas del cliente (self-serve cap).
 * Con `bmBucket` cuenta solo las de ese BM — el serial del nombre es por BM.
 */
export async function countHecomTikTokAccountsForCliente(
  clientId: string,
  bmBucket?: string | null,
): Promise<number> {
  const id = clientId.trim();
  if (!id) return 0;
  const hecom = createHecomAdminClient();
  let query = hecom
    .from("cliente_tiktok_cuentas")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id);
  const bucket = String(bmBucket ?? "").trim();
  if (bucket) query = query.eq("bm_bucket", bucket);
  const { count, error } = await query;
  if (error) {
    console.warn("[hecom] count_tiktok_cuentas", { error: error.message });
    throw new Error("No se pudo leer las cuentas TikTok del cliente en Hecom.");
  }
  return count ?? 0;
}

/** Cuentas que ocupan cupo self-serve: todas menos las excluidas por gerencia. */
export async function countHecomTikTokAccountsForQuota(clientId: string): Promise<number> {
  const id = clientId.trim();
  if (!id) return 0;
  const uncounted = resolveTikTokSelfServeUncountedAdvertisers(id);
  if (uncounted.length === 0) return countHecomTikTokAccountsForCliente(id);
  const hecom = createHecomAdminClient();
  const { data, error } = await hecom
    .from("cliente_tiktok_cuentas")
    .select("advertiser_id")
    .eq("client_id", id);
  if (error) {
    console.warn("[hecom] count_tiktok_cuentas_quota", { error: error.message });
    throw new Error("No se pudo leer las cuentas TikTok del cliente en Hecom.");
  }
  const skip = new Set(uncounted);
  return (data ?? []).filter((row) => !skip.has(String(row.advertiser_id ?? "").trim())).length;
}

/**
 * Inserta advertiser en Hecom `cliente_tiktok_cuentas`.
 * Idempotente si el advertiser_id ya existe para ese client_id.
 */
export async function linkTikTokCuentaToHecomCliente(
  input: LinkTikTokCuentaInput,
): Promise<LinkTikTokCuentaResult> {
  const clientId = input.clientId.trim();
  const advertiserId = input.advertiserId.trim();
  const advertiserName = input.advertiserName.trim() || advertiserId;
  const bmBucket = String(input.bmBucket ?? "").trim();
  if (!clientId || !advertiserId || !bmBucket) {
    throw new Error("Faltan client_id, advertiser_id o bm_bucket para Hecom.");
  }

  const hecom = createHecomAdminClient();
  // `fee` es el % de comisión Hecom (5–10), no el tier del BM. Sin valor se copia
  // el fee del cliente (o 10 %): vacío, la sync de Hecom cobra 10 % igual y soporte
  // lo ve en blanco (pedido de Annie, 09/10/2026).
  let fee =
    input.fee != null && Number.isFinite(Number(input.fee))
      ? Number(input.fee)
      : null;
  if (fee == null) {
    const { data: cliente } = await hecom
      .from("clientes")
      .select("tiktok_default_fee")
      .eq("id", clientId)
      .maybeSingle();
    fee =
      normalizeFeePercent(cliente?.tiktok_default_fee ?? null) ??
      DEFAULT_DEPOSIT_FEE_PERCENT;
  }

  const { data: existing } = await hecom
    .from("cliente_tiktok_cuentas")
    .select("id,advertiser_id,client_id")
    .eq("advertiser_id", advertiserId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    if (String(existing.client_id) !== clientId) {
      throw new Error(
        "Ese advertiser TikTok ya está mapeado a otro cliente en Hecom.",
      );
    }
    return {
      id: String(existing.id),
      advertiserId,
      alreadyExisted: true,
    };
  }

  const { data, error } = await hecom
    .from("cliente_tiktok_cuentas")
    .insert({
      client_id: clientId,
      advertiser_id: advertiserId,
      advertiser_name: advertiserName,
      bm_bucket: bmBucket,
      fee,
      sync_enabled: input.syncEnabled !== false,
    })
    .select("id,advertiser_id")
    .single();

  if (error || !data?.id) {
    console.error("[hecom] link_tiktok_cuenta_failed", {
      clientId,
      advertiserId,
      error: error?.message ?? null,
    });
    throw new Error(
      error?.message ||
        "No se pudo guardar la cuenta en Hecom. La cuenta puede existir en TikTok: contactá soporte.",
    );
  }

  // Primary en clientes si estaba vacío
  const { data: cliente } = await hecom
    .from("clientes")
    .select("id,tiktok_advertiser_id")
    .eq("id", clientId)
    .maybeSingle();
  if (cliente && !cliente.tiktok_advertiser_id) {
    await hecom
      .from("clientes")
      .update({
        tiktok_advertiser_id: advertiserId,
        tiktok_advertiser_name: advertiserName,
        tiktok_sync_enabled: true,
      })
      .eq("id", clientId);
  }

  return {
    id: String(data.id),
    advertiserId: String(data.advertiser_id ?? advertiserId),
    alreadyExisted: false,
  };
}
