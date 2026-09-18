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

/** Veredicto TikTok del anuncio (post-publish), distinto del status Holistic del draft. */
export type CreativeTikTokReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "unknown";

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
  previewUrl: string | null;
  posterUrl: string | null;
  mediaKind: "video" | "image" | null;
};

export type CreativeDraftListItem = {
  id: string;
  status: CreativePublishDraftStatus;
  assetName: string | null;
  accountName: string | null;
  adAccountId: string | null;
  externalAdvertiserId: string | null;
  brief: CreativeAgentBrief;
  errorMessage: string | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  tiktokReviewStatus: CreativeTikTokReviewStatus | null;
  tiktokRejectReasons: string[];
  tiktokSecondaryStatus: string | null;
  /** Draft rechazado que esta versión corrige. */
  parentDraftId: string | null;
  parentLabel: string | null;
  /** Ya hay un draft hijo en curso / publicado (no insistir en re-subir). */
  hasActiveFix: boolean;
  /** Origen: Holistic vs descubierto en Ads Manager. */
  discoverSource: "holistic" | "tiktok_ads_manager" | null;
  previewUrl: string | null;
  posterUrl: string | null;
  mediaKind: "video" | "image" | null;
};
