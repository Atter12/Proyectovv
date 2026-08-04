import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAdAccountLedgerAccounts } from "@/lib/ledger/ledger.server";
import {
  getHecomCliente,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import {
  listHolisticBcAdvertisers,
  resolveBcIdForHecomBucket,
  type TikTokBcAdvertiser,
} from "@/lib/integrations/tiktok/bc-advertisers.server";

function resolveHecomAccounts(cliente: HecomCliente): HecomTiktokAccount[] {
  if (cliente.tiktokAccounts.length > 0) return cliente.tiktokAccounts;
  if (cliente.tiktokAdvertiserId) {
    return [
      {
        advertiserId: cliente.tiktokAdvertiserId,
        advertiserName: cliente.tiktokAdvertiserName,
        bmBucket: null,
        fee: cliente.tiktokDefaultFee,
        syncEnabled: cliente.tiktokSyncEnabled !== false,
      },
    ];
  }
  return [];
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Branlyn Lopez 206,0 USD" ≈ cliente "Branlyn Lopez" */
function advertiserMatchesCliente(
  advertiserName: string,
  clienteName: string,
): boolean {
  const adv = normalizeName(advertiserName);
  const client = normalizeName(clienteName);
  if (!adv || !client || client.length < 4) return false;
  if (adv.startsWith(client)) return true;
  const tokens = client.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.every((token) => adv.includes(token));
}

export type SyncApprovedAdAccountsResult = {
  approvedAdvertiserIds: string[];
  upserted: number;
  disabled: number;
  skippedUnavailableStatus: boolean;
};

/**
 * Asegura que Holistic tenga filas fondeables = advertisers Aprobados
 * del cliente (mapeo Hecom + match por nombre en BM).
 * Oculta/desactiva suspendidas.
 */
export async function syncApprovedAdAccountsForCliente(input: {
  organizationId: string;
  clienteId: string;
  userId?: string | null;
}): Promise<SyncApprovedAdAccountsResult> {
  const cliente = await getHecomCliente(input.clienteId);
  if (!cliente) {
    return {
      approvedAdvertiserIds: [],
      upserted: 0,
      disabled: 0,
      skippedUnavailableStatus: true,
    };
  }

  let bcAdvertisers: TikTokBcAdvertiser[] = [];
  let statusAvailable = true;
  try {
    bcAdvertisers = await listHolisticBcAdvertisers({
      organizationId: input.organizationId,
    });
  } catch (error) {
    statusAvailable = false;
    console.warn("[hecom-sync] bc_list_unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const byId = new Map(bcAdvertisers.map((row) => [row.advertiserId, row]));
  const hecomAccounts = resolveHecomAccounts(cliente).filter(
    (account) => account.syncEnabled !== false,
  );
  const hecomIds = new Set(
    hecomAccounts.map((a) => a.advertiserId.trim()).filter(Boolean),
  );

  const candidates = new Map<
    string,
    {
      advertiserId: string;
      name: string;
      bcId: string;
      statusKind: "approved" | "suspended" | "unknown";
      fromHecom: boolean;
    }
  >();

  for (const account of hecomAccounts) {
    const id = account.advertiserId.trim();
    const live = byId.get(id);
    candidates.set(id, {
      advertiserId: id,
      name:
        live?.advertiserName ||
        account.advertiserName?.trim() ||
        `${cliente.name} · TikTok`,
      bcId: resolveBcIdForHecomBucket(
        account.bmBucket,
        live?.bcId,
      ),
      statusKind: live?.statusKind ?? (statusAvailable ? "unknown" : "unknown"),
      fromHecom: true,
    });
  }

  // Cuentas aprobadas del BM con el nombre del cliente (ej. 206 si Hecom solo mapeó 204).
  for (const live of bcAdvertisers) {
    if (live.statusKind !== "approved") continue;
    if (!advertiserMatchesCliente(live.advertiserName, cliente.name)) continue;
    const existing = candidates.get(live.advertiserId);
    if (existing) {
      existing.statusKind = "approved";
      existing.name = live.advertiserName || existing.name;
      existing.bcId = live.bcId || existing.bcId;
      continue;
    }
    candidates.set(live.advertiserId, {
      advertiserId: live.advertiserId,
      name: live.advertiserName || `${cliente.name} · TikTok`,
      bcId: live.bcId,
      statusKind: "approved",
      fromHecom: hecomIds.has(live.advertiserId),
    });
  }

  const approved = [...candidates.values()].filter(
    (row) => row.statusKind === "approved",
  );
  const suspended = [...candidates.values()].filter(
    (row) => row.statusKind === "suspended",
  );

  // Si TikTok no respondió, no inventamos: devolvemos IDs Hecom pero sin upsert agresivo.
  if (!statusAvailable) {
    return {
      approvedAdvertiserIds: [...hecomIds],
      upserted: 0,
      disabled: 0,
      skippedUnavailableStatus: true,
    };
  }

  const admin = createAdminClient();
  let upserted = 0;
  let disabled = 0;

  for (const row of approved) {
    const { error } = await admin.from("ad_accounts").upsert(
      {
        organization_id: input.organizationId,
        name: row.name,
        platform: "tiktok",
        external_account_id: row.advertiserId,
        external_business_id: row.bcId,
        external_account_name: row.name,
        status: "active",
        currency: "USD",
        timezone: "America/Lima",
        created_by: input.userId ?? null,
        last_synced_at: new Date().toISOString(),
        metadata: {
          source: "hecom_approved_sync",
          hecom_cliente_id: input.clienteId,
          hecom_cliente_name: cliente.name,
          tiktok_status: "approved",
          from_hecom_map: row.fromHecom,
        },
      },
      { onConflict: "organization_id,platform,external_account_id" },
    );

    if (error) {
      console.warn("[hecom-sync] upsert_failed", {
        advertiserId: row.advertiserId,
        error: error.message,
      });
      continue;
    }

    const { data: stored } = await admin
      .from("ad_accounts")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("platform", "tiktok")
      .eq("external_account_id", row.advertiserId)
      .maybeSingle<{ id: string }>();

    if (stored?.id) {
      await ensureAdAccountLedgerAccounts(stored.id).catch(() => undefined);
    }
    upserted += 1;
  }

  for (const row of suspended) {
    const { data: existing } = await admin
      .from("ad_accounts")
      .select("id, status")
      .eq("organization_id", input.organizationId)
      .eq("platform", "tiktok")
      .eq("external_account_id", row.advertiserId)
      .maybeSingle<{ id: string; status: string }>();

    if (!existing?.id || existing.status === "disabled") continue;

    const { error } = await admin
      .from("ad_accounts")
      .update({
        status: "disabled",
        last_synced_at: new Date().toISOString(),
        metadata: {
          source: "hecom_approved_sync",
          hecom_cliente_id: input.clienteId,
          tiktok_status: "suspended",
        },
      })
      .eq("id", existing.id);

    if (!error) disabled += 1;
  }

  const approvedAdvertiserIds = approved.map((row) => row.advertiserId);

  console.info("[hecom-sync] approved_sync", {
    clienteId: input.clienteId,
    clienteName: cliente.name,
    approved: approvedAdvertiserIds.length,
    upserted,
    disabled,
  });

  return {
    approvedAdvertiserIds,
    upserted,
    disabled,
    skippedUnavailableStatus: false,
  };
}
