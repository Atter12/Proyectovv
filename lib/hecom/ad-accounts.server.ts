import "server-only";
import { cache } from "react";
import {
  getHecomCliente,
  isOtpTestClienteId,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import {
  listHolisticBcAdvertisers,
  listHolisticBcAdvertisersCachedFirst,
  peekHolisticBcAdvertisersCache,
  resolveBmBucketFromBcId,
  warmHolisticBcAdvertisers,
  type TikTokBcAdvertiser,
  type TikTokBcAdvertiserStatusKind,
} from "@/lib/integrations/tiktok/bc-advertisers.server";
import {
  resolveHecomMappedStatusKind,
} from "@/lib/hecom/tiktok-advertiser-discovery";
import {
  isStaffBlockedAdAccount,
  isStaffBlockedHecomCliente,
} from "@/lib/payments/staff-block.server";
import type { AdAccount, AdAccountsOverview } from "@/types/ad-account";

export { advertiserMatchesCliente } from "@/lib/hecom/advertiser-match";

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

function resolveDisplayName(input: {
  clienteName: string;
  hecomName: string | null | undefined;
  liveName: string | null | undefined;
  bmBucket: string | null | undefined;
}): string {
  const live = input.liveName?.trim();
  if (live) return live;
  const hecom = input.hecomName?.trim();
  if (hecom) return hecom;
  const bucket = input.bmBucket?.trim();
  if (bucket) return `${input.clienteName} · BM ${bucket}`;
  return `${input.clienteName} · TikTok`;
}

export function mapHecomTiktokToAdAccount(
  cliente: HecomCliente,
  account: HecomTiktokAccount,
  liveStatusKind: TikTokBcAdvertiserStatusKind = "unknown",
  liveName?: string | null,
  liveBcId?: string | null,
  options?: { trustHecomMap?: boolean },
): AdAccount {
  const bmBucket = resolveAccountBmBucket(account.bmBucket, liveBcId);
  const label = resolveDisplayName({
    clienteName: cliente.name,
    hecomName: account.advertiserName,
    liveName,
    bmBucket,
  });
  const statusKind =
    options?.trustHecomMap === true
      ? resolveHecomMappedStatusKind(account, liveStatusKind)
      : liveStatusKind;
  const status =
    isStaffBlockedAdAccount({
      externalAccountId: account.advertiserId,
      hecomClienteId: cliente.id,
    }) || isStaffBlockedHecomCliente(cliente.id)
      ? "disabled"
      : account.syncEnabled === false
        ? "disabled"
        : statusKind === "suspended"
          ? "disabled"
          : statusKind === "approved"
            ? "active"
            : account.syncEnabled
              ? "pending"
              : "disabled";

  const thresholdInfo =
    isStaffBlockedAdAccount({
      externalAccountId: account.advertiserId,
      hecomClienteId: cliente.id,
    }) || isStaffBlockedHecomCliente(cliente.id)
      ? "Bloqueada por staff — no recargar"
      : account.syncEnabled === false
      ? "Pausada en Hecom (sync desactivado)"
      : statusKind === "approved"
        ? account.fee != null
          ? `Aprobada · fee ${account.fee}%`
          : "Aprobada en TikTok"
        : statusKind === "suspended"
          ? "Suspendida / baneada en TikTok"
          : account.fee != null
            ? `Fee Hecom ${account.fee}%`
            : "Cuenta Hecom Club";

  return {
    id: `hecom:${cliente.id}:${account.advertiserId}`,
    name: label,
    platform: "tiktok",
    bcId: bmBucket || account.advertiserId,
    externalAccountId: account.advertiserId,
    externalBusinessId: bmBucket,
    externalAccountName: liveName?.trim() || account.advertiserName,
    status,
    cost: account.fee ?? 0,
    dailyBudget: 0,
    monthlyLimit: 0,
    balance: 0,
    autoRecharge: false,
    rechargeThreshold: 0,
    thresholdInfo,
    timezone: "America/Lima",
    connectionLabel: "Hecom · TikTok Ads",
    isArchived: false,
  };
}

function resolveAccountBmBucket(
  bmBucket: string | null | undefined,
  bcId?: string | null,
): string | null {
  const bucket = bmBucket?.trim();
  if (bucket && /^\d{1,3}$/.test(bucket)) return bucket;
  return resolveBmBucketFromBcId(bcId);
}

export type HecomAdAccountsLoadSpeed = "fast" | "live";

/** BM TikTok para Cuentas ads: cache-first; en "fast" no bloquea en cold TikTok. */
async function resolveBmAdvertisersForAdAccounts(
  speed: HecomAdAccountsLoadSpeed,
): Promise<{
  live: TikTokBcAdvertiser[];
  liveSource: "cache" | "live" | "none";
}> {
  if (speed === "live") {
    try {
      const live = await listHolisticBcAdvertisers();
      return { live, liveSource: live.length > 0 ? "live" : "none" };
    } catch (error) {
      console.warn("[ad-accounts] bc_live_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      const cached = peekHolisticBcAdvertisersCache({ allowStaleMs: 15 * 60 * 1000 });
      return {
        live: cached ?? [],
        liveSource: cached && cached.length > 0 ? "cache" : "none",
      };
    }
  }

  // fast: nunca esperar pull TikTok en cold — Hecom IDs alcanzan para pintar.
  const live = await listHolisticBcAdvertisersCachedFirst();
  if (live.length > 0) {
    return { live, liveSource: "cache" };
  }
  warmHolisticBcAdvertisers();
  return { live: [], liveSource: "none" };
}

/**
 * Cuentas ads del cliente.
 * - Prioridad: mapeo Hecom por advertiser_id (activo o suspendido).
 * - Fallback: BM TikTok match por nombre (aprobadas + suspendidas).
 * - Nombres: preferir nombre exacto de TikTok cuando hay ID en live.
 */
export const getHecomClienteAdAccountsOverview = cache(
  async function getHecomClienteAdAccountsOverview(
    clienteId: string,
    speed: HecomAdAccountsLoadSpeed = "fast",
  ): Promise<AdAccountsOverview & { cliente: HecomCliente | null }> {
    return getHecomClienteAdAccountsOverviewImpl(clienteId, speed);
  },
);

async function getHecomClienteAdAccountsOverviewImpl(
  clienteId: string,
  speed: HecomAdAccountsLoadSpeed = "fast",
): Promise<AdAccountsOverview & { cliente: HecomCliente | null }> {
  const started = Date.now();

  const emptySummary = {
    totalAccounts: 0,
    activeAccounts: 0,
    assignedBalance: 0,
    pendingSetup: 0,
    disabledAccounts: 0,
  };

  const cliente = await getHecomCliente(clienteId);
  if (!cliente) {
    return { cliente: null, accounts: [], summary: emptySummary };
  }

  if (isOtpTestClienteId(clienteId)) {
    return { cliente, accounts: [], summary: emptySummary };
  }

  const allHecomAccounts = resolveHecomAccounts(cliente);
  const hecomAccounts = allHecomAccounts;

  let liveById = new Map<string, TikTokBcAdvertiser>();
  let liveSource: "cache" | "live" | "none" = "none";

  try {
    const bm = await resolveBmAdvertisersForAdAccounts(speed);
    const live = bm.live;
    liveSource = bm.liveSource;

    // Solo enriquecemos por advertiser_id. NUNCA por nombre (fuga entre clientes
    // con el mismo nombre de pila, ej. "Sebastian" → Cruz/Reategui).
    if (live.length > 0) {
      liveById = new Map(live.map((row) => [row.advertiserId, row]));
    }
  } catch (error) {
    console.warn("[ad-accounts] bc_status_skip", {
      clienteId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  // Solo IDs mapeados en Hecom (cliente_tiktok_cuentas / tiktok_advertiser_id).
  const mapped = hecomAccounts
    .map((account) => {
      const live = liveById.get(account.advertiserId.trim());
      return mapHecomTiktokToAdAccount(
        cliente,
        {
          ...account,
          bmBucket:
            resolveAccountBmBucket(account.bmBucket, live?.bcId) ||
            account.bmBucket,
        },
        live?.statusKind ?? "unknown",
        live?.advertiserName,
        live?.bcId,
        { trustHecomMap: true },
      );
    })
    .filter((account) => Boolean(account.externalAccountId?.trim()));

  const byExternalId = new Map<string, AdAccount>();
  for (const account of mapped) {
    const key = account.externalAccountId?.trim() || account.id;
    const prev = byExternalId.get(key);
    if (!prev) {
      byExternalId.set(key, account);
      continue;
    }
    // Preferir suspendida sobre activa (ban gana al vínculo ENABLE).
    const rank = (s: AdAccount["status"]) =>
      s === "disabled" ? 3 : s === "active" ? 2 : s === "pending" ? 1 : 0;
    if (rank(account.status) >= rank(prev.status)) {
      byExternalId.set(key, account);
    }
  }

  // Mostrar activas, suspendidas (disabled) y pendientes. No ocultar baneadas.
  const accounts = [...byExternalId.values()].sort((a, b) => {
    const order = (s: AdAccount["status"]) =>
      s === "active" ? 0 : s === "pending" ? 1 : s === "disabled" ? 2 : 3;
    const d = order(a.status) - order(b.status);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, "es");
  });

  console.info("[ad-accounts] overview", {
    clienteId,
    clienteName: cliente.name,
    speed,
    ms: Date.now() - started,
    hecomMapped: hecomAccounts.length,
    liveSource,
    shown: accounts.length,
    active: accounts.filter((a) => a.status === "active").length,
    suspended: accounts.filter((a) => a.status === "disabled").length,
  });

  return {
    cliente,
    accounts,
    summary: {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.status === "active").length,
      assignedBalance: 0,
      pendingSetup: accounts.filter((a) => a.status === "pending").length,
      disabledAccounts: accounts.filter((a) => a.status === "disabled").length,
    },
  };
}
