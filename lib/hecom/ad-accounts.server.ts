import "server-only";
import {
  getHecomCliente,
  type HecomCliente,
  type HecomTiktokAccount,
} from "@/lib/hecom/clientes.server";
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

export function mapHecomTiktokToAdAccount(
  cliente: HecomCliente,
  account: HecomTiktokAccount,
): AdAccount {
  const label =
    account.advertiserName?.trim() ||
    `${cliente.name} · TikTok`;
  return {
    id: `hecom:${cliente.id}:${account.advertiserId}`,
    name: label,
    platform: "tiktok",
    bcId: account.bmBucket || account.advertiserId,
    externalAccountId: account.advertiserId,
    externalBusinessId: account.bmBucket,
    externalAccountName: account.advertiserName,
    status: account.syncEnabled ? "active" : "disabled",
    cost: account.fee ?? 0,
    dailyBudget: 0,
    monthlyLimit: 0,
    balance: 0,
    autoRecharge: false,
    rechargeThreshold: 0,
    thresholdInfo: account.fee != null ? `Fee Hecom ${account.fee}%` : "Cuenta Hecom Club",
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

  const hecomAccounts = resolveHecomAccounts(cliente);
  const accounts = hecomAccounts.map((account) =>
    mapHecomTiktokToAdAccount(cliente, account),
  );

  return {
    cliente,
    accounts,
    summary: {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.status === "active").length,
      assignedBalance: 0,
      pendingSetup: 0,
    },
  };
}
