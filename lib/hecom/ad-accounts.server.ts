import "server-only";
import {
  getHecomCliente,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
import {
  listHolisticBcAdvertisers,
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

export async function getHecomClienteAdAccountsOverview(
  clienteId: string,
): Promise<AdAccountsOverview & { cliente: HecomCliente | null }> {
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

  const hecomAccounts = resolveHecomAccounts(cliente).filter(
    (account) => account.syncEnabled !== false,
  );

  let statusById = new Map<string, TikTokBcAdvertiserStatusKind>();
  let liveApprovedExtras: Array<{
    advertiserId: string;
    advertiserName: string;
  }> = [];

  try {
    const live = await listHolisticBcAdvertisers();
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
  } catch {
    // sin estado TikTok: mostramos Hecom mapeadas
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

  // Solo aprobadas cuando conocemos estado; si no hay status API, dejamos mapeadas.
  const hasLiveStatus = statusById.size > 0;
  const accounts = [...mapped, ...extras].filter((account) => {
    if (!hasLiveStatus) return account.status !== "disabled";
    return account.status === "active";
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
