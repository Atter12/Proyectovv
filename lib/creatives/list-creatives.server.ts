import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreativeAccountOption,
  CreativeAnalysisInsight,
  CreativeAssetListItem,
  CreativeAgentBrief,
  CreativeDraftListItem,
  CreativePublishDraftStatus,
} from "@/lib/creatives/types";
import { formatBmBucketLabel } from "@/lib/hecom/bm-bucket.shared";

export type { CreativeDraftListItem };

export async function listCreativeAccountOptions(
  organizationId: string,
): Promise<CreativeAccountOption[]> {
  if (!organizationId) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ad_accounts")
    .select(
      "id, name, status, external_account_id, external_business_id, platform",
    )
    .eq("organization_id", organizationId)
    .eq("platform", "tiktok")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(100);

  if (error) {
    console.warn("[creatives] list_accounts", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    externalAccountId: (row.external_account_id as string | null) ?? null,
    bmLabel: formatBmBucketLabel(null, row.external_business_id as string | null),
    status: row.status as string,
  }));
}

function insightFromResult(row: {
  overall_score: number | null;
  clarity_score: number | null;
  brand_score: number | null;
  compliance_score: number | null;
  recommendations: unknown;
  detected_issues: unknown;
  raw_output: Record<string, unknown> | null;
  summary?: string | null;
}): CreativeAnalysisInsight {
  const raw = row.raw_output ?? {};
  return {
    overallScore: Number(row.overall_score ?? 0),
    clarityScore: Number(row.clarity_score ?? 0),
    brandScore: Number(row.brand_score ?? 0),
    complianceScore: Number(row.compliance_score ?? 0),
    summary: String(raw.summary ?? row.summary ?? ""),
    hooks: Array.isArray(raw.hooks)
      ? raw.hooks.map((h) => String(h))
      : [],
    policyRisks: Array.isArray(row.detected_issues)
      ? row.detected_issues.map((h) => String(h))
      : Array.isArray(raw.policy_risks)
        ? (raw.policy_risks as unknown[]).map((h) => String(h))
        : [],
    whyItMayPerform: String(raw.why_it_may_perform ?? ""),
    recommendations: Array.isArray(row.recommendations)
      ? row.recommendations.map((h) => String(h))
      : [],
  };
}

export async function listOrganizationCreativeAssets(
  organizationId: string,
): Promise<CreativeAssetListItem[]> {
  if (!organizationId) return [];
  const admin = createAdminClient();

  const { data: assets, error } = await admin
    .from("creative_assets")
    .select(
      "id, name, asset_type, mime_type, status, created_at, ad_account_id, external_advertiser_id",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !assets?.length) {
    if (error) console.warn("[creatives] list_assets", error.message);
    return [];
  }

  const assetIds = assets.map((a) => a.id as string);
  const accountIds = [
    ...new Set(
      assets
        .map((a) => a.ad_account_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [jobsRes, accountsRes] = await Promise.all([
    admin
      .from("creative_analysis_jobs")
      .select("id, creative_asset_id, status, created_at")
      .eq("organization_id", organizationId)
      .in("creative_asset_id", assetIds)
      .order("created_at", { ascending: false })
      .limit(120),
    accountIds.length
      ? admin
          .from("ad_accounts")
          .select("id, name")
          .in("id", accountIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const latestJobByAsset = new Map<
    string,
    { id: string; status: string }
  >();
  for (const job of jobsRes.data ?? []) {
    const assetId = job.creative_asset_id as string | null;
    if (!assetId || latestJobByAsset.has(assetId)) continue;
    latestJobByAsset.set(assetId, {
      id: job.id as string,
      status: job.status as string,
    });
  }

  const jobIds = [...latestJobByAsset.values()].map((j) => j.id);
  const resultsRes = jobIds.length
    ? await admin
        .from("creative_analysis_results")
        .select(
          "job_id, overall_score, clarity_score, brand_score, compliance_score, recommendations, detected_issues, raw_output, summary",
        )
        .in("job_id", jobIds)
    : { data: [] as Array<Record<string, unknown>> };

  const resultByJob = new Map(
    (resultsRes.data ?? []).map((row) => [row.job_id as string, row]),
  );
  const accountNameById = new Map(
    (accountsRes.data ?? []).map((row) => [row.id, row.name]),
  );

  return assets.map((asset) => {
    const job = latestJobByAsset.get(asset.id as string) ?? null;
    const result = job ? resultByJob.get(job.id) : null;
    return {
      id: asset.id as string,
      name: asset.name as string,
      assetType: asset.asset_type as string,
      mimeType: (asset.mime_type as string | null) ?? null,
      status: asset.status as string,
      createdAt: asset.created_at as string,
      adAccountId: (asset.ad_account_id as string | null) ?? null,
      externalAdvertiserId:
        (asset.external_advertiser_id as string | null) ?? null,
      accountName: asset.ad_account_id
        ? (accountNameById.get(asset.ad_account_id as string) ?? null)
        : null,
      jobStatus: job?.status ?? null,
      jobId: job?.id ?? null,
      insight: result
        ? insightFromResult(
            result as {
              overall_score: number | null;
              clarity_score: number | null;
              brand_score: number | null;
              compliance_score: number | null;
              recommendations: unknown;
              detected_issues: unknown;
              raw_output: Record<string, unknown> | null;
              summary?: string | null;
            },
          )
        : null,
    };
  });
}

export async function listOrganizationCreativeDrafts(
  organizationId: string,
): Promise<CreativeDraftListItem[]> {
  if (!organizationId) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("creative_publish_drafts")
    .select(
      "id, status, brief, error_message, created_at, reviewed_at, published_at, creative_asset_id, ad_account_id, external_advertiser_id",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data?.length) {
    if (error) console.warn("[creatives] list_drafts", error.message);
    return [];
  }

  const assetIds = [
    ...new Set(
      data
        .map((d) => d.creative_asset_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const accountIds = [
    ...new Set(
      data
        .map((d) => d.ad_account_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [assetsRes, accountsRes] = await Promise.all([
    assetIds.length
      ? admin.from("creative_assets").select("id, name").in("id", assetIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    accountIds.length
      ? admin.from("ad_accounts").select("id, name").in("id", accountIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const assetName = new Map(
    (assetsRes.data ?? []).map((r) => [r.id, r.name]),
  );
  const accountName = new Map(
    (accountsRes.data ?? []).map((r) => [r.id, r.name]),
  );

  return data.map((row) => {
    const brief = (row.brief ?? {}) as Partial<CreativeAgentBrief>;
    return {
      id: row.id as string,
      status: row.status as CreativePublishDraftStatus,
      assetName: row.creative_asset_id
        ? (assetName.get(row.creative_asset_id as string) ?? null)
        : null,
      accountName: row.ad_account_id
        ? (accountName.get(row.ad_account_id as string) ?? null)
        : null,
      externalAdvertiserId:
        (row.external_advertiser_id as string | null) ?? null,
      brief: {
        objective: String(brief.objective ?? "TRAFFIC"),
        audience: String(brief.audience ?? ""),
        hookCopy: String(brief.hookCopy ?? ""),
        adText: String(brief.adText ?? ""),
        callToAction: String(brief.callToAction ?? "SHOP_NOW"),
        campaignName: String(brief.campaignName ?? ""),
        adgroupName: String(brief.adgroupName ?? ""),
        adName: String(brief.adName ?? ""),
        suggestedDailyBudgetUsd: Number(brief.suggestedDailyBudgetUsd ?? 20),
        landingPageUrl: brief.landingPageUrl ?? null,
        notes: Array.isArray(brief.notes)
          ? brief.notes.map((n) => String(n))
          : [],
      },
      errorMessage: (row.error_message as string | null) ?? null,
      createdAt: row.created_at as string,
      reviewedAt: (row.reviewed_at as string | null) ?? null,
      publishedAt: (row.published_at as string | null) ?? null,
    };
  });
}
