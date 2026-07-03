import type { AdAccount, AdAccountsOverview } from "@/types/ad-account";

export const adAccountsMock: AdAccount[] = [];

/**
 * Descomenta para previsualizar una fila en la tabla:
 *
 * export const adAccountsMock: AdAccount[] = [sampleAdAccount];
 */
export const sampleAdAccount: AdAccount = {
  id: "acc-001",
  name: "Default Ads Account",
  bcId: "BC-0001",
  status: "pending",
  cost: 0,
  balance: 0,
  autoRecharge: false,
  thresholdInfo: "Sin umbral",
  timezone: "UTC-05 Lima",
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
