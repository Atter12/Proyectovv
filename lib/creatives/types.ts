export type CreativeAnalysisInsight = {
  overallScore: number;
  clarityScore: number;
  brandScore: number;
  complianceScore: number;
  summary: string;
  hooks: string[];
  policyRisks: string[];
  whyItMayPerform: string;
  recommendations: string[];
};

export type CreativeAgentBrief = {
  objective: string;
  audience: string;
  hookCopy: string;
  adText: string;
  callToAction: string;
  campaignName: string;
  adgroupName: string;
  adName: string;
  suggestedDailyBudgetUsd: number;
  landingPageUrl: string | null;
  notes: string[];
};

export type CreativePublishDraftStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "publishing"
  | "published"
  | "failed";

export type CreativeAccountOption = {
  id: string;
  name: string;
  externalAccountId: string | null;
  bmLabel: string | null;
  status: string;
};

export type CreativeAssetListItem = {
  id: string;
  name: string;
  assetType: string;
  mimeType: string | null;
  status: string;
  createdAt: string;
  adAccountId: string | null;
  externalAdvertiserId: string | null;
  accountName: string | null;
  jobStatus: string | null;
  jobId: string | null;
  insight: CreativeAnalysisInsight | null;
};

export type CreativeDraftListItem = {
  id: string;
  status: CreativePublishDraftStatus;
  assetName: string | null;
  accountName: string | null;
  externalAdvertiserId: string | null;
  brief: CreativeAgentBrief;
  errorMessage: string | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};
