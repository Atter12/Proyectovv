import type { AdAccount } from "@/types/ad-account";
import type { Wallet } from "@/types/wallet";

export interface DashboardMetrics {
  todaySpend: number;
  referralEarnings: number;
  referralMembers: number;
  totalAdAccounts: number;
  spend30d: number;
  impressions30d: number;
  clicks30d: number;
  conversions30d: number;
  revenue30d: number;
  totalCampaigns: number;
}

export interface DashboardOnboardingStep {
  step: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface DashboardOverview {
  wallet: Wallet;
  metrics: DashboardMetrics;
  adAccounts: AdAccount[];
  onboardingSteps: DashboardOnboardingStep[];
}
