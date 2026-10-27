import "server-only";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getRealProfitAdmin } from "@/lib/realprofit/db.server";

/** Estado de las 4 fuentes de Real Profit COD para el panel de conexiones. */
export type RpConnections = {
  shopify: { connected: boolean; storeId: string | null; storeName: string | null; shopDomain: string | null };
  tiktok: { connected: boolean; accounts: number };
  meta: {
    connected: boolean;
    accountName: string | null;
    lastSyncAt: string | null;
    lastSyncError: string | null;
  };
  courier: { ordersFromCourier: number; lastImportAt: string | null };
};

export async function loadRpConnections(input: {
  hecomClienteId: string;
  linkedStores: Array<{ id: string; name: string; shopDomain: string | null }>;
}): Promise<RpConnections> {
  const store = input.linkedStores[0] ?? null;
  const admin = getRealProfitAdmin();

  const [overview, metaRow, courierCount, courierLast] = await Promise.all([
    getHecomClienteAdAccountsOverview(input.hecomClienteId, "fast").catch(() => null),
    loadMetaIntegration(admin, input.hecomClienteId),
    store
      ? admin
          .from("rp_orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id)
          .eq("status_source", "courier")
      : null,
    store
      ? admin
          .from("rp_orders")
          .select("updated_at")
          .eq("store_id", store.id)
          .eq("status_source", "courier")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null,
  ]);

  const tiktokAccounts = (overview?.accounts ?? []).filter((a) =>
    (a.externalAccountId ?? "").trim(),
  ).length;
  const meta = metaRow;

  return {
    shopify: {
      connected: Boolean(store),
      storeId: store?.id ?? null,
      storeName: store?.name ?? null,
      shopDomain: store?.shopDomain ?? null,
    },
    tiktok: { connected: tiktokAccounts > 0, accounts: tiktokAccounts },
    meta: {
      connected: Boolean(meta),
      accountName: meta?.account_name ? String(meta.account_name) : null,
      lastSyncAt: meta?.last_sync_at ? String(meta.last_sync_at) : null,
      lastSyncError: meta?.last_sync_error ? String(meta.last_sync_error) : null,
    },
    courier: {
      ordersFromCourier: courierCount?.count ?? 0,
      lastImportAt: courierLast?.data?.updated_at ? String(courierLast.data.updated_at) : null,
    },
  };
}

/** Meta puede vivir en la tienda real o en la «solo ads» (conectó Meta antes que Shopify). */
async function loadMetaIntegration(
  admin: ReturnType<typeof getRealProfitAdmin>,
  hecomClienteId: string,
) {
  const { data: links } = await admin
    .from("hecom_cliente_rp_stores")
    .select("rp_store_id")
    .eq("hecom_cliente_id", hecomClienteId);
  const ids = (links ?? []).map((l) => String(l.rp_store_id ?? "")).filter(Boolean);
  if (ids.length === 0) return null;
  const { data } = await admin
    .from("rp_ad_integrations")
    .select("account_name, last_sync_at, last_sync_error")
    .in("store_id", ids)
    .eq("platform", "meta")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
