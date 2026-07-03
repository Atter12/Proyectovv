export type AdAccountStatus = "active" | "pending" | "disabled" | "review";

export interface AdAccount {
  id: string;
  name: string;
  bcId: string;
  status: AdAccountStatus;
  cost: number;
  balance: number;
  autoRecharge: boolean;
  thresholdInfo: string;
  timezone: string;
}

export interface AdAccountsSummary {
  totalAccounts: number;
  activeAccounts: number;
  assignedBalance: number;
  pendingSetup: number;
}

export interface AdAccountsOverview {
  summary: AdAccountsSummary;
  accounts: AdAccount[];
}
