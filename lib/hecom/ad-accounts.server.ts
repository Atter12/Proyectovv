import "server-only";
import {
  getHecomCliente,
  isOtpTestClienteId,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import {
  listHolisticBcAdvertisers,
  listHolisticBcAdvertisersCachedFirst,
  type TikTokBcAdvertiser,
  type TikTokBcAdvertiserStatusKind,
} from "@/lib/integrations/tiktok/bc-advertisers.server";
import type { AdAccount, AdAccountsOverview } from "@/types/ad-account";

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

export function mapHecomTiktokToAdAccount(
  cliente: HecomCliente,
  account: HecomTiktokAccount,
  statusKind: TikTokBcAdvertiserStatusKind = "unknown",
): AdAccount {
  const label =
    account.advertiserName?.trim() || `${cliente.name} · TikTok`;
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
    externalAccountName: account.advertiserName,
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
          ? "Suspendida en TikTok"
          : account.fee != null
            ? `Fee Hecom ${account.fee}%`
            : "Cuenta Hecom Club",
    timezone: "America/Lima",
    connectionLabel: "Hecom · TikTok Ads",
    isArchived: false,
  };
}

/**
 * Cuentas ads del cliente.
 * - Con mapeo Hecom: muestra rápido (cache TikTok si hay).
 * - Sin mapeo Hecom: consulta BM TikTok y matchea por nombre (como Hecom Club / path histórico).
 *   Sin esto, el gerente ve “sin cuentas” y no puede fondear.
 */
export async function getHecomClienteAdAccountsOverview(
  clienteId: string,
): Promise<AdAccountsOverview & { cliente: HecomCliente | null }> {
  const started = Date.now();

  const cliente = await getHecomCliente(clienteId);
  if (!cliente) {
    return {
      cliente: null,
      accounts: [],
      summary: {
        totalAccounts: 0,
        activeAccounts: 0,
        assignedBalance: 0,
        pendingSetup: 0,
      },
    };
  }

  if (isOtpTestClienteId(clienteId)) {
    return {
      cliente,
      accounts: [],
      summary: {
        totalAccounts: 0,
        activeAccounts: 0,
        assignedBalance: 0,
        pendingSetup: 0,
      },
    };
  }

  const hecomAccounts = resolveHecomAccounts(cliente).filter(
    (account) => account.syncEnabled !== false,
  );

  let statusById = new Map<string, TikTokBcAdvertiserStatusKind>();
  let liveApprovedExtras: Array<{
    advertiserId: string;
    advertiserName: string;
  }> = [];
  let liveSource: "cache" | "live" | "none" = "none";

  try {
    let live: TikTokBcAdvertiser[] =
      await listHolisticBcAdvertisersCachedFirst();
    liveSource = live.length > 0 ? "cache" : "none";

    // Sin mapeo en Hecom (caso típico), hay que ir al BM por nombre.
    // También si cache vacío: un force para no dejar 0 cuentas al gerente.
    if (hecomAccounts.length === 0 || live.length === 0) {
      try {
        live = await listHolisticBcAdvertisers();
        liveSource = live.length > 0 ? "live" : "none";
      } catch (error) {
        console.warn("[ad-accounts] bc_live_failed", {
          clienteId,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    if (live.length > 0) {
      statusById = new Map(live.map((row) => [row.advertiserId, row.statusKind]));
      liveApprovedExtras = live
        .filter(
          (row) =>
            row.statusKind === "approved" &&
            advertiserMatchesCliente(row.advertiserName, cliente.name) &&
            !hecomAccounts.some((h) => h.advertiserId === row.advertiserId),
        )
        .map((row) => ({
          advertiserId: row.advertiserId,
          advertiserName: row.advertiserName,
        }));
    }
  } catch (error) {
    console.warn("[ad-accounts] bc_status_skip", {
      clienteId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const mapped = hecomAccounts.map((account) =>
    mapHecomTiktokToAdAccount(
      cliente,
      account,
      statusById.get(account.advertiserId) ?? "unknown",
    ),
  );

  const extras = liveApprovedExtras.map((row) =>
    mapHecomTiktokToAdAccount(
      cliente,
      {
        advertiserId: row.advertiserId,
        advertiserName: row.advertiserName,
        bmBucket: null,
        fee: cliente.tiktokDefaultFee,
        syncEnabled: true,
      },
      "approved",
    ),
  );

  const hasLiveStatus = statusById.size > 0;
  // Con snapshot TikTok: solo aprobadas (fondeables).
  // Sin snapshot: mostrar mapeo Hecom para no vaciar la UI.
  const accounts = [...mapped, ...extras].filter((account) => {
    if (!hasLiveStatus) return account.status !== "disabled";
    return account.status === "active";
  });

  console.info("[ad-accounts] overview", {
    clienteId,
    clienteName: cliente.name,
    ms: Date.now() - started,
    hecomMapped: hecomAccounts.length,
    bmMatches: liveApprovedExtras.length,
    liveSource,
    shown: accounts.length,
  });

  return {
    cliente,
    accounts,
    summary: {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.status === "active").length,
      assignedBalance: 0,
      pendingSetup: accounts.filter((a) => a.status === "pending").length,
    },
  };
}
