import "server-only";
import { cache } from "react";
import {
  getHecomCliente,
  isOtpTestClienteId,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import { advertiserMatchesCliente } from "@/lib/hecom/advertiser-match";
import {
  listHolisticBcAdvertisers,
  listHolisticBcAdvertisersCachedFirst,
  searchHolisticBcAdvertisers,
  warmHolisticBcAdvertisers,
  type TikTokBcAdvertiser,
  type TikTokBcAdvertiserStatusKind,
} from "@/lib/integrations/tiktok/bc-advertisers.server";
import { normalizeAdvertiserName } from "@/lib/hecom/advertiser-match";
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
  statusKind: TikTokBcAdvertiserStatusKind = "unknown",
  liveName?: string | null,
): AdAccount {
  const label = resolveDisplayName({
    clienteName: cliente.name,
    hecomName: account.advertiserName,
    liveName,
    bmBucket: account.bmBucket,
  });
  const status =
    statusKind === "suspended"
      ? "disabled"
      : statusKind === "approved"
        ? "active"
        : account.syncEnabled
          ? "pending"
          : "disabled";

  return {
    id: `hecom:${cliente.id}:${account.advertiserId}`,
    name: label,
    platform: "tiktok",
    bcId: account.bmBucket || account.advertiserId,
    externalAccountId: account.advertiserId,
    externalBusinessId: account.bmBucket,
    externalAccountName: liveName?.trim() || account.advertiserName,
    status,
    cost: account.fee ?? 0,
    dailyBudget: 0,
    monthlyLimit: 0,
    balance: 0,
    autoRecharge: false,
    rechargeThreshold: 0,
    thresholdInfo:
      statusKind === "approved"
        ? account.fee != null
          ? `Aprobada · fee ${account.fee}%`
          : "Aprobada en TikTok"
        : statusKind === "suspended"
          ? "Suspendida / baneada en TikTok"
          : account.fee != null
            ? `Fee Hecom ${account.fee}%`
            : "Cuenta Hecom Club",
    timezone: "America/Lima",
    connectionLabel: "Hecom · TikTok Ads",
    isArchived: false,
  };
}

export type HecomAdAccountsLoadSpeed = "fast" | "live";

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

  const hecomAccounts = resolveHecomAccounts(cliente).filter(
    (account) => account.syncEnabled !== false,
  );
  const hecomIds = new Set(
    hecomAccounts.map((a) => a.advertiserId.trim()).filter(Boolean),
  );

  let liveById = new Map<string, TikTokBcAdvertiser>();
  let nameMatchedExtras: TikTokBcAdvertiser[] = [];
  let liveSource: "cache" | "live" | "none" = "none";

  try {
    let live: TikTokBcAdvertiser[] = [];
    liveSource = "none";

    if (speed === "live") {
      try {
        live = await listHolisticBcAdvertisers();
        liveSource = live.length > 0 ? "live" : "none";
      } catch (error) {
        console.warn("[ad-accounts] bc_live_failed", {
          clienteId,
          error: error instanceof Error ? error.message : "unknown",
        });
        live = await listHolisticBcAdvertisersCachedFirst();
        liveSource = live.length > 0 ? "cache" : "none";
      }
    } else {
      live = await listHolisticBcAdvertisersCachedFirst();
      liveSource = live.length > 0 ? "cache" : "none";
      warmHolisticBcAdvertisers();
    }

    if (live.length > 0) {
      liveById = new Map(live.map((row) => [row.advertiserId, row]));

      // Fallback nombre: aprobadas + suspendidas (no solo activas).
      nameMatchedExtras = live.filter((row) => {
        if (hecomIds.has(row.advertiserId)) return false;
        if (
          row.statusKind !== "approved" &&
          row.statusKind !== "suspended"
        ) {
          return false;
        }
        return advertiserMatchesCliente(row.advertiserName, cliente.name);
      });

      // Keyword search es costoso (muchas llamadas BM) — solo en modo live (Pagos).
      if (speed === "live") {
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

          const prev = liveById.get(row.advertiserId);
          if (!prev || prev.statusKind !== "suspended") {
            liveById.set(row.advertiserId, row);
          }
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

  // A) ID-first: filas Hecom que sigan existiendo en BM (evita IDs obsoletos).
  const mapped = hecomAccounts
    .map((account) => {
      const live = liveById.get(account.advertiserId.trim());
      return mapHecomTiktokToAdAccount(
        cliente,
        {
          ...account,
          bmBucket: account.bmBucket || live?.bcId || null,
        },
        live?.statusKind ?? "unknown",
        live?.advertiserName,
      );
    })
    .filter((account) => {
      const id = account.externalAccountId?.trim();
      if (!id) return false;
      if (liveById.size === 0) return true;
      return liveById.has(id);
    });

  // B) Extras solo por nombre cuando no hay ID Hecom.
  const extras = nameMatchedExtras.map((row) =>
    mapHecomTiktokToAdAccount(
      cliente,
      {
        advertiserId: row.advertiserId,
        advertiserName: row.advertiserName,
        bmBucket: row.bcId,
        fee: cliente.tiktokDefaultFee,
        syncEnabled: true,
      },
      row.statusKind,
      row.advertiserName,
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
