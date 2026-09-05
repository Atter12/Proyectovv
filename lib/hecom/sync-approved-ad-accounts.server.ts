import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAdAccountLedgerAccounts } from "@/lib/ledger/ledger.server";
import {
  getHecomCliente,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import { advertiserMatchesCliente } from "@/lib/hecom/advertiser-match";
import {
  listHolisticBcAdvertisers,
  listHolisticBcAdvertisersCachedFirst,
  resolveBcIdForHecomBucket,
  type TikTokBcAdvertiser,
} from "@/lib/integrations/tiktok/bc-advertisers.server";
import {
  isHecomMappedAccountFundable,
} from "@/lib/hecom/tiktok-advertiser-discovery";
import {
  isStaffBlockedAdAccount,
  mergeStaffBlockMetadata,
  staffBlockStatusForUpsert,
} from "@/lib/payments/staff-block.server";
import { isRecord } from "@/lib/records";

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

export type SyncApprovedAdAccountsResult = {
  approvedAdvertiserIds: string[];
  /** Advertisers suspendidos/baneados en TikTok (para sección Recuperar en Pagos). */
  suspendedAdvertiserIds: string[];
  upserted: number;
  disabled: number;
  skippedUnavailableStatus: boolean;
};

const SYNC_TTL_MS = 5 * 60 * 1000;
const SYNC_EMPTY_TTL_MS = 20 * 1000;
const SYNC_FAIL_TTL_MS = 30 * 1000;
const syncResultCache = new Map<
  string,
  { at: number; result: SyncApprovedAdAccountsResult }
>();

/**
 * Asegura que Holistic tenga filas fondeables = advertisers del mapa Hecom
 * (y match por nombre en BM solo si el cliente no tiene IDs mapeados).
 * Oculta/desactiva suspendidas.
 * Cache 5 min por cliente; fallos/vacíos se cachean poco (gerente no se queda
 * sin “Asignar” por un cold miss de TikTok).
 */
export async function syncApprovedAdAccountsForCliente(input: {
  organizationId: string;
  clienteId: string;
  userId?: string | null;
  forceRefresh?: boolean;
}): Promise<SyncApprovedAdAccountsResult> {
  const cacheKey = `${input.organizationId}:${input.clienteId}`;
  const hit = syncResultCache.get(cacheKey);
  if (!input.forceRefresh && hit && Array.isArray(hit.result.suspendedAdvertiserIds)) {
    const ttl =
      hit.result.skippedUnavailableStatus
        ? SYNC_FAIL_TTL_MS
        : hit.result.approvedAdvertiserIds.length === 0
          ? SYNC_EMPTY_TTL_MS
          : SYNC_TTL_MS;
    if (Date.now() - hit.at < ttl) {
      return hit.result;
    }
  }

  const cliente = await getHecomCliente(input.clienteId);
  if (!cliente) {
    const empty: SyncApprovedAdAccountsResult = {
      approvedAdvertiserIds: [],
      suspendedAdvertiserIds: [],
      upserted: 0,
      disabled: 0,
      skippedUnavailableStatus: true,
    };
    syncResultCache.set(cacheKey, { at: Date.now(), result: empty });
    return empty;
  }

  let bcAdvertisers: TikTokBcAdvertiser[] = [];
  let statusAvailable = true;
  try {
    // Siempre live para sync de fondeo (no cache-first cold []).
    // forceRefresh / vacíos: lista BM completa + match por nombre.
    const hecomPre = resolveHecomAccounts(cliente).filter(
      (account) => account.syncEnabled !== false,
    );
    if (input.forceRefresh || hecomPre.length === 0) {
      bcAdvertisers = await listHolisticBcAdvertisers({
        organizationId: input.organizationId,
        forceRefresh: Boolean(input.forceRefresh),
      });
    } else {
      bcAdvertisers = await listHolisticBcAdvertisersCachedFirst({
        organizationId: input.organizationId,
      });
      if (bcAdvertisers.length === 0) {
        bcAdvertisers = await listHolisticBcAdvertisers({
          organizationId: input.organizationId,
        });
      }
    }
    if (bcAdvertisers.length === 0) {
      statusAvailable = false;
    }
  } catch (error) {
    statusAvailable = false;
    console.warn("[hecom-sync] bc_list_unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const byId = new Map(bcAdvertisers.map((row) => [row.advertiserId, row]));
  const allHecomAccounts = resolveHecomAccounts(cliente);
  const hecomAccounts = allHecomAccounts.filter(
    (account) => account.syncEnabled !== false,
  );
  const hecomIds = new Set(
    hecomAccounts.map((a) => a.advertiserId.trim()).filter(Boolean),
  );

  // Match por nombre desde el snapshot BM (sin keyword TikTok en el request crítico).
  const nameMatchedExtras: TikTokBcAdvertiser[] = [];
  if (statusAvailable) {
    for (const row of bcAdvertisers) {
      if (hecomIds.has(row.advertiserId)) continue;
      if (
        row.statusKind !== "approved" &&
        row.statusKind !== "suspended" &&
        row.statusKind !== "unknown"
      ) {
        continue;
      }
      if (advertiserMatchesCliente(row.advertiserName, cliente.name)) {
        nameMatchedExtras.push(row);
      }
    }
  }

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
    const statusKind = live?.statusKind ?? "unknown";
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
      statusKind,
      fromHecom: true,
    });
  }

  // BM por nombre: actualizar estado de IDs Hecom; extras nuevas solo si no hay mapa.
  // Con mapa Hecom, no fondear/upsert hermanas solo por nombre (evita 2↔N en Pagos).
  for (const live of bcAdvertisers) {
    if (live.statusKind !== "approved" && live.statusKind !== "suspended") {
      continue;
    }
    if (!advertiserMatchesCliente(live.advertiserName, cliente.name)) continue;
    const existing = candidates.get(live.advertiserId);
    if (existing) {
      existing.statusKind = live.statusKind;
      existing.name = live.advertiserName || existing.name;
      existing.bcId = live.bcId || existing.bcId;
      continue;
    }
    if (hecomIds.size > 0) continue;
    candidates.set(live.advertiserId, {
      advertiserId: live.advertiserId,
      name: live.advertiserName || `${cliente.name} · TikTok`,
      bcId: live.bcId,
      statusKind: live.statusKind,
      fromHecom: false,
    });
  }

  const approved = [...candidates.values()].filter(
    (row) =>
      row.statusKind === "approved" ||
      (row.fromHecom &&
        hecomAccounts.some(
          (account) =>
            account.advertiserId === row.advertiserId &&
            isHecomMappedAccountFundable(account, row.statusKind),
        )),
  );
  const suspended = [...candidates.values()].filter(
    (row) => row.statusKind === "suspended",
  );

  // Si TikTok no respondió, no inventamos: devolvemos IDs Hecom pero sin upsert agresivo.
  if (!statusAvailable) {
    return {
      approvedAdvertiserIds: [...hecomIds],
      suspendedAdvertiserIds: [],
      upserted: 0,
      disabled: 0,
      skippedUnavailableStatus: true,
    };
  }

  const admin = createAdminClient();
  let upserted = 0;
  let disabled = 0;

  const advertiserIds = [
    ...new Set([
      ...approved.map((row) => row.advertiserId),
      ...suspended.map((row) => row.advertiserId),
    ]),
  ];
  const existingByAdvertiser = new Map<
    string,
    { metadata: unknown; status: string | null }
  >();
  if (advertiserIds.length > 0) {
    const { data: existingRows } = await admin
      .from("ad_accounts")
      .select("external_account_id, metadata, status")
      .eq("organization_id", input.organizationId)
      .eq("platform", "tiktok")
      .in("external_account_id", advertiserIds);
    for (const existing of existingRows ?? []) {
      const ext = String(
        (existing as { external_account_id?: string }).external_account_id ?? "",
      ).trim();
      if (!ext) continue;
      existingByAdvertiser.set(ext, {
        metadata: (existing as { metadata?: unknown }).metadata ?? null,
        status: String((existing as { status?: string }).status ?? "") || null,
      });
    }
  }

  for (const row of approved) {
    const existing = existingByAdvertiser.get(row.advertiserId);
    const block = staffBlockStatusForUpsert({
      existingMetadata: existing?.metadata,
      externalAccountId: row.advertiserId,
      hecomClienteId: input.clienteId,
      tiktokStatusKind: row.statusKind,
    });
    const metadata = block.blocked
      ? mergeStaffBlockMetadata(existing?.metadata ?? null, {
          reason: "emergency_staff_block",
        })
      : {
          ...(isRecord(existing?.metadata) ? existing.metadata : {}),
          source: "hecom_approved_sync",
          hecom_cliente_id: input.clienteId,
          hecom_cliente_name: cliente.name,
          tiktok_status: "approved",
          from_hecom_map: row.fromHecom,
        };

    const { error } = await admin.from("ad_accounts").upsert(
      {
        organization_id: input.organizationId,
        name: row.name,
        platform: "tiktok",
        external_account_id: row.advertiserId,
        external_business_id: row.bcId,
        external_account_name: row.name,
        status: block.status,
        currency: "USD",
        timezone: "America/Lima",
        created_by: input.userId ?? null,
        last_synced_at: new Date().toISOString(),
        metadata,
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
    const { error } = await admin.from("ad_accounts").upsert(
      {
        organization_id: input.organizationId,
        name: row.name,
        platform: "tiktok",
        external_account_id: row.advertiserId,
        external_business_id: row.bcId,
        external_account_name: row.name,
        status: "disabled",
        currency: "USD",
        timezone: "America/Lima",
        created_by: input.userId ?? null,
        last_synced_at: new Date().toISOString(),
        metadata: {
          source: "hecom_approved_sync",
          hecom_cliente_id: input.clienteId,
          hecom_cliente_name: cliente.name,
          tiktok_status: "suspended",
          from_hecom_map: row.fromHecom,
        },
      },
      { onConflict: "organization_id,platform,external_account_id" },
    );

    if (!error) disabled += 1;
    else {
      console.warn("[hecom-sync] suspend_upsert_failed", {
        advertiserId: row.advertiserId,
        error: error.message,
      });
    }
  }

  const approvedAdvertiserIds = approved
    .map((row) => row.advertiserId)
    .filter(
      (advertiserId) =>
        !isStaffBlockedAdAccount({
          externalAccountId: advertiserId,
          hecomClienteId: input.clienteId,
          metadata: existingByAdvertiser.get(advertiserId)?.metadata,
        }),
    );
  const suspendedAdvertiserIds = [
    ...suspended.map((row) => row.advertiserId),
    ...approved
      .map((row) => row.advertiserId)
      .filter((advertiserId) =>
        isStaffBlockedAdAccount({
          externalAccountId: advertiserId,
          hecomClienteId: input.clienteId,
          metadata: existingByAdvertiser.get(advertiserId)?.metadata,
        }),
      ),
  ];

  console.info("[hecom-sync] approved_sync", {
    clienteId: input.clienteId,
    clienteName: cliente.name,
    approved: approvedAdvertiserIds.length,
    suspended: suspendedAdvertiserIds.length,
    upserted,
    disabled,
  });

  const result: SyncApprovedAdAccountsResult = {
    approvedAdvertiserIds,
    suspendedAdvertiserIds,
    upserted,
    disabled,
    skippedUnavailableStatus: false,
  };
  syncResultCache.set(cacheKey, { at: Date.now(), result });
  return result;
}
