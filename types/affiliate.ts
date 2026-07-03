export interface AffiliateMilestone {
  id: string;
  name: string;
  requirement: string;
  commission: string;
}

export interface BannerSize {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface AffiliateProgram {
  referralLink: string;
  bannerSizes: BannerSize[];
  milestones: AffiliateMilestone[];
  notes: string[];
}
