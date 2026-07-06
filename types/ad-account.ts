export type AdAccountStatus = "active" | "pending" | "disabled" | "review" | "archived";
export type AdAccountPlatform = "meta" | "google" | "tiktok" | "linkedin" | "other";

export interface AdAccount {
  id: string;
  name: string;
  platform: AdAccountPlatform;
  bcId: string;
  externalAccountId: string | null;
  externalBusinessId: string | null;
  externalAccountName: string | null;
  status: AdAccountStatus;
  cost: number;
  dailyBudget: number;
  monthlyLimit: number;
  balance: number;
  autoRecharge: boolean;
  rechargeThreshold: number;
  thresholdInfo: string;
  timezone: string;
  connectionLabel: string;
  isArchived: boolean;
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
