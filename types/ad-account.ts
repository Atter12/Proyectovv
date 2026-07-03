export type AdAccountStatus = "active" | "pending" | "suspended" | "inactive";

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
