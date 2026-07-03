export type AffiliateTabKey = "earn" | "payments";

export interface ReferralStep {
  id: string;
  step: number;
  title: string;
  description: string;
  status: "pending" | "available";
  optionalAction?: string;
}

export interface BannerSize {
  id: string;
  label: string;
  width: number;
  height: number;
  formatName: string;
}

export interface AffiliateMilestone {
  id: string;
  name: string;
  requirement: string;
  commission: string;
  commissionPercent: number;
  description: string;
  isTop?: boolean;
}

export interface AffiliateStats {
  totalReferrals: number;
  activeReferrals: number;
  estimatedCommission: number;
  paidCommission: number;
  clicks: number;
  registrations: number;
}

export interface AffiliateProgramOverview {
  referralCode: string;
  referralUrl: string;
  stats: AffiliateStats;
  selectedBannerSize: string;
  bannerSizes: BannerSize[];
  milestones: AffiliateMilestone[];
  steps: ReferralStep[];
  notes: string[];
}

/** @deprecated Use AffiliateProgramOverview */
export interface AffiliateProgram {
  referralLink: string;
  bannerSizes: BannerSize[];
  milestones: AffiliateMilestone[];
  notes: string[];
}
