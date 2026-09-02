import "server-only";
import { cache } from "react";
import {
  getHecomCliente,
  isOtpTestClienteId,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import { advertiserMatchesCliente, normalizeAdvertiserName } from "@/lib/hecom/advertiser-match";
import {
  listHolisticBcAdvertisers,
  mergeTikTokAdvertiserIntoMap,
  peekHolisticBcAdvertisersCache,
  resolveBmBucketFromBcId,
  searchHolisticBcAdvertisers,
  warmHolisticBcAdvertisers,
  type TikTokBcAdvertiser,
  type TikTokBcAdvertiserStatusKind,
} from "@/lib/integrations/tiktok/bc-advertisers.server";
import {
  discoverTikTokAdvertisersForCliente,
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

/** BM TikTok para Cuentas ads: cache si hay; si no, live (necesario para match por nombre). */
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

  const cached = peekHolisticBcAdvertisersCache({ allowStaleMs: 15 * 60 * 1000 });
  if (cached && cached.length > 0) {
    warmHolisticBcAdvertisers();
    return { live: cached, liveSource: "cache" };
  }

  // Cache fría: sin BM no hay match por nombre (ej. Adriana 200/201/202 USD).
  try {
    const live = await listHolisticBcAdvertisers();
    return { live, liveSource: live.length > 0 ? "live" : "none" };
  } catch (error) {
    console.warn("[ad-accounts] bc_cold_fetch_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    warmHolisticBcAdvertisers();
    return { live: [], liveSource: "none" };
  }
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
  const hecomIds = new Set(
    hecomAccounts.map((a) => a.advertiserId.trim()).filter(Boolean),
  );

  let liveById = new Map<string, TikTokBcAdvertiser>();
  let nameMatchedExtras: TikTokBcAdvertiser[] = [];
  let liveSource: "cache" | "live" | "none" = "none";
  let keywordHitCount = 0;

  try {
    const bm = await resolveBmAdvertisersForAdAccounts(speed);
    let live = bm.live;
    liveSource = bm.liveSource;

    if (live.length > 0) {
      liveById = new Map(live.map((row) => [row.advertiserId, row]));

      // Fallback nombre: aprobadas + suspendidas (no solo activas).
      nameMatchedExtras = live.filter((row) => {
        if (hecomIds.has(row.advertiserId)) return false;
        if (
          row.statusKind !== "approved" &&
          row.statusKind !== "suspended" &&
          row.statusKind !== "unknown"
        ) {
          return false;
        }
        return advertiserMatchesCliente(row.advertiserName, cliente.name);
      });
    }

    // Keyword TikTok: solo en "live". En "fast" alcanza el snapshot BM + match nombre
    // (evita 6+ roundtrips lentos al entrar a Cuentas ads / Pagos).
    if (speed === "live") {
      keywordHitCount = await discoverTikTokAdvertisersForCliente({
        cliente,
        hecomIds,
        hecomAccounts,
        liveById,
        nameMatchedExtras,
      });

      if (live.length > 0) {
        const keywords = [
          ...new Set(
            [
              cliente.name.trim(),
              ...normalizeAdvertiserName(cliente.name)
                .split(" ")
                .filter((t) => t.length >= 5),
            ].filter(Boolean),
          ),
        ].slice(0, 3);

        const keywordSuspended = (
          await Promise.all(
            keywords.map((keyword) =>
              searchHolisticBcAdvertisers({ keyword }).catch(() => []),
            ),
          )
        ).flat();

        for (const row of keywordSuspended) {
          const belongs =
            hecomIds.has(row.advertiserId) ||
            advertiserMatchesCliente(row.advertiserName, cliente.name);
          if (!belongs) continue;

          mergeTikTokAdvertiserIntoMap(liveById, row);
          if (hecomIds.has(row.advertiserId)) continue;
          if (
            !nameMatchedExtras.some((x) => x.advertiserId === row.advertiserId)
          ) {
            nameMatchedExtras.push(row);
          }
        }
      }
    }
  } catch (error) {
    console.warn("[ad-accounts] bc_status_skip", {
      clienteId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  // A) ID-first: filas Hecom. No ocultar mapeos explícitos aunque falten en el snapshot BM.
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

  // B) Extras solo por nombre cuando no hay ID Hecom.
  const extras = nameMatchedExtras.map((row) =>
    mapHecomTiktokToAdAccount(
      cliente,
      {
        advertiserId: row.advertiserId,
        advertiserName: row.advertiserName,
        bmBucket: resolveBmBucketFromBcId(row.bcId),
        fee: cliente.tiktokDefaultFee,
        syncEnabled: true,
      },
      row.statusKind,
      row.advertiserName,
      row.bcId,
    ),
  );

  const byExternalId = new Map<string, AdAccount>();
  for (const account of [...mapped, ...extras]) {
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
    bmNameMatches: nameMatchedExtras.length,
    keywordBackfill: keywordHitCount,
    bmNameMatchesSuspended: nameMatchedExtras.filter(
      (r) => r.statusKind === "suspended",
    ).length,
    bmSuspendedNameHits: liveById.size
      ? [...liveById.values()].filter(
          (r) =>
            r.statusKind === "suspended" &&
            advertiserMatchesCliente(r.advertiserName, cliente.name),
        ).length
      : 0,
    sampleSuspendedHits: [...liveById.values()]
      .filter(
        (r) =>
          r.statusKind === "suspended" &&
          advertiserMatchesCliente(r.advertiserName, cliente.name),
      )
      .slice(0, 5)
      .map((r) => ({
        id: r.advertiserId,
        name: r.advertiserName,
        status: r.statusRaw,
      })),
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
