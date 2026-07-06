import type { AdAccount, AdAccountsOverview } from "@/types/ad-account";

export const adAccountsMock: AdAccount[] = [];

/**
 * Descomenta para previsualizar una fila en la tabla:
 *
 * export const adAccountsMock: AdAccount[] = [sampleAdAccount];
 */
export const sampleAdAccount: AdAccount = {
  id: "acc-001",
  name: "Cuenta publicitaria Default",
  platform: "tiktok",
  bcId: "BC-0001",
  externalAccountId: null,
  externalBusinessId: "BC-0001",
  externalAccountName: null,
  status: "pending",
  cost: 0,
  dailyBudget: 0,
  monthlyLimit: 0,
  balance: 0,
  autoRecharge: false,
  rechargeThreshold: 0,
  thresholdInfo: "Sin umbral",
  timezone: "UTC-05 Lima",
  connectionLabel: "Manual/Demo",
  isArchived: false,
};

export const adAccountsOverviewMock: AdAccountsOverview = {
  summary: {
    totalAccounts: 0,
    activeAccounts: 0,
    assignedBalance: 0,
    pendingSetup: 0,
  },
  accounts: adAccountsMock,
};
