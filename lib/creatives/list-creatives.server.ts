import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreativeAccountOption,
  CreativeAnalysisInsight,
  CreativeAssetListItem,
  CreativeAgentBrief,
  CreativeDraftListItem,
  CreativePublishDraftStatus,
  CreativeTikTokReviewStatus,
} from "@/lib/creatives/types";
import { formatBmBucketLabel } from "@/lib/hecom/bm-bucket.shared";
import { mediaKindFrom } from "@/lib/creatives/tiktok-media-preview";
import { cleanCreativeDisplayName } from "@/lib/creatives/clean-display-name";

export type { CreativeDraftListItem };

const PREVIEW_TTL_SECONDS = 60 * 60;

async function signedUrlById(
  admin: ReturnType<typeof createAdminClient>,
  rows: Array<{
    id: string;
    bucket: string | null;
    path: string | null;
  }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byBucket = new Map<string, Array<{ id: string; path: string }>>();
  for (const row of rows) {
    const bucket = row.bucket?.trim() ?? "";
    const path = row.path?.trim() ?? "";
    if (!bucket || !path) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push({ id: row.id, path });
    byBucket.set(bucket, list);
  }

  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, items]) => {
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrls(
          items.map((item) => item.path),
          PREVIEW_TTL_SECONDS,
        );
      if (error || !data) return;
      data.forEach((item, index) => {
        const id = items[index]?.id;
        if (id && item.signedUrl) out.set(id, item.signedUrl);
      });
    }),
  );
  return out;
}

function httpUrl(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return /^https?:\/\//i.test(text) ? text : null;
}

export async function listCreativeAccountOptions(
  organizationId: string,
  options?: {
    /** Obligatorio en Creativos: solo cuentas del cliente activo. */
    hecomClienteId?: string | null;
    /** Advertisers Hecom / sync del cliente (refuerzo por ID TikTok). */
    advertiserIds?: string[] | null;
  },
): Promise<CreativeAccountOption[]> {
  if (!organizationId) return [];
  const hecomClienteId = options?.hecomClienteId?.trim() || null;
  const advertiserIds = [
    ...new Set(
      (options?.advertiserIds ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    ),
  ];

  // Sin cliente seleccionado no listamos la org entera (evita leak cross-cliente).
  if (!hecomClienteId && advertiserIds.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  let query = admin
    .from("ad_accounts")
    .select(
      "id, name, status, external_account_id, external_business_id, platform, metadata",
    )
    .eq("organization_id", organizationId)
    .eq("platform", "tiktok")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(150);

  // Prefer DB filter by cliente; advertiserIds refuerza en memoria.
  if (hecomClienteId) {
    query = query.eq("metadata->>hecom_cliente_id", hecomClienteId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[creatives] list_accounts", error.message);
    return [];
  }

  const advertiserSet = new Set(advertiserIds);
  let rows = data ?? [];

  // Si el sync aún no etiquetó metadata, complementamos por advertiser_id Hecom.
  if (hecomClienteId && rows.length === 0 && advertiserSet.size > 0) {
    const { data: byAdv, error: advErr } = await admin
      .from("ad_accounts")
      .select(
        "id, name, status, external_account_id, external_business_id, platform, metadata",
      )
      .eq("organization_id", organizationId)
      .eq("platform", "tiktok")
      .eq("status", "active")
      .in("external_account_id", [...advertiserSet])
      .order("name", { ascending: true })
      .limit(150);
    if (advErr) {
      console.warn("[creatives] list_accounts_by_adv", advErr.message);
    } else {
      rows = byAdv ?? [];
    }
  } else if (!hecomClienteId && advertiserSet.size > 0) {
    rows = rows.filter((row) =>
      advertiserSet.has(String(row.external_account_id ?? "").trim()),
    );
  }

  return rows.map((row) => ({
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
  const clip = (s: string, n = 220) =>
    s.length > n ? `${s.slice(0, n - 1)}…` : s;
  const clipList = (items: string[], max = 4) =>
    items.slice(0, max).map((h) => clip(String(h), 160));
  return {
    overallScore: Number(row.overall_score ?? 0),
    clarityScore: Number(row.clarity_score ?? 0),
    brandScore: Number(row.brand_score ?? 0),
    complianceScore: Number(row.compliance_score ?? 0),
    summary: clip(String(raw.summary ?? row.summary ?? "")),
    hooks: Array.isArray(raw.hooks)
      ? clipList(raw.hooks.map((h) => String(h)))
      : [],
    policyRisks: Array.isArray(row.detected_issues)
      ? clipList(row.detected_issues.map((h) => String(h)))
      : Array.isArray(raw.policy_risks)
        ? clipList((raw.policy_risks as unknown[]).map((h) => String(h)))
        : [],
    whyItMayPerform: clip(String(raw.why_it_may_perform ?? "")),
    recommendations: Array.isArray(row.recommendations)
      ? clipList(row.recommendations.map((h) => String(h)))
      : [],
  };
}

function slimBriefForList(brief: Partial<CreativeAgentBrief>): CreativeAgentBrief {
  const clip = (s: string, n = 180) =>
    s.length > n ? `${s.slice(0, n - 1)}…` : s;
  return {
    objective: String(brief.objective ?? "TRAFFIC"),
    audience: clip(String(brief.audience ?? "")),
    hookCopy: clip(String(brief.hookCopy ?? "")),
    adText: clip(String(brief.adText ?? ""), 280),
    callToAction: String(brief.callToAction ?? "SHOP_NOW"),
    campaignName: clip(String(brief.campaignName ?? ""), 120),
    adgroupName: clip(String(brief.adgroupName ?? ""), 120),
    adName: clip(String(brief.adName ?? ""), 120),
    suggestedDailyBudgetUsd: Number(brief.suggestedDailyBudgetUsd ?? 20),
    landingPageUrl: brief.landingPageUrl ?? null,
    notes: Array.isArray(brief.notes)
      ? brief.notes.slice(0, 4).map((n) => clip(String(n), 220))
      : [],
  };
}

export async function listOrganizationCreativeAssets(
  organizationId: string,
  options?: {
    hecomClienteId?: string | null;
    advertiserIds?: string[] | null;
    adAccountIds?: string[] | null;
    /** Cap de filas en entrada (default: 120 scoped / 40). */
    limit?: number;
  },
): Promise<CreativeAssetListItem[]> {
  if (!organizationId) return [];
  const admin = createAdminClient();

  const advertiserSet = new Set(
    (options?.advertiserIds ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean),
  );
  const adAccountSet = new Set(
    (options?.adAccountIds ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean),
  );
  const scoped = Boolean(options?.hecomClienteId?.trim()) || advertiserSet.size > 0;

  if (scoped && advertiserSet.size === 0 && adAccountSet.size === 0) {
    return [];
  }

  const fetchLimit =
    typeof options?.limit === "number" && options.limit > 0
      ? Math.min(Math.floor(options.limit), 120)
      : scoped
        ? 120
        : 40;

  const { data: assetsRaw, error } = await admin
    .from("creative_assets")
    .select(
      "id, name, asset_type, mime_type, status, created_at, ad_account_id, external_advertiser_id, storage_bucket, storage_path, thumbnail_url, public_url",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error || !assetsRaw?.length) {
    if (error) console.warn("[creatives] list_assets", error.message);
    return [];
  }

  const assets = scoped
    ? assetsRaw.filter((row) => {
        const accountId = String(row.ad_account_id ?? "").trim();
        const advertiserId = String(row.external_advertiser_id ?? "").trim();
        if (accountId && adAccountSet.has(accountId)) return true;
        if (advertiserId && advertiserSet.has(advertiserId)) return true;
        return false;
      })
    : assetsRaw;

  if (!assets.length) {
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
      .limit(Math.min(fetchLimit, 120)),
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

  const signedByAsset = await signedUrlById(
    admin,
    assets.map((asset) => ({
      id: asset.id as string,
      bucket: (asset.storage_bucket as string | null) ?? null,
      path: (asset.storage_path as string | null) ?? null,
    })),
  );

  return assets.map((asset) => {
    const job = latestJobByAsset.get(asset.id as string) ?? null;
    const result = job ? resultByJob.get(job.id) : null;
    const mimeType = (asset.mime_type as string | null) ?? null;
    const assetType = asset.asset_type as string;
    const signed = signedByAsset.get(asset.id as string) ?? null;
    const poster =
      httpUrl(asset.thumbnail_url) ??
      (mimeType?.startsWith("image/") || assetType === "image"
        ? signed
        : null);
    const preview =
      signed ??
      httpUrl(asset.public_url) ??
      poster;
    return {
      id: asset.id as string,
      name: asset.name as string,
      assetType,
      mimeType,
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
      previewUrl: preview,
      posterUrl: poster ?? (mimeType?.startsWith("video/") ? null : preview),
      mediaKind: mediaKindFrom({
        mimeType,
        assetType,
        previewUrl: preview,
        posterUrl: poster,
      }),
    };
  });
}

export async function listOrganizationCreativeDrafts(
  organizationId: string,
  options?: {
    hecomClienteId?: string | null;
    advertiserIds?: string[] | null;
    adAccountIds?: string[] | null;
    /** Cap de filas en entrada (default: 150 scoped / 40). */
    limit?: number;
    /** Solo publicados rechazados, los más nuevos. Tope 8. */
    recentRejected?: boolean;
    /** Estados Holistic (borrador / aprobado / fallido). */
    statusIn?: string[] | null;
  },
): Promise<CreativeDraftListItem[]> {
  if (!organizationId) return [];
  const admin = createAdminClient();

  const advertiserSet = new Set(
    (options?.advertiserIds ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean),
  );
  const adAccountSet = new Set(
    (options?.adAccountIds ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean),
  );
  const hecomClienteId = options?.hecomClienteId?.trim() || null;

  // Si hay cliente Hecom, resolver cuentas/advertisers desde DB (no depender solo del page).
  if (hecomClienteId && (advertiserSet.size === 0 || adAccountSet.size === 0)) {
    const { data: scopedAccounts } = await admin
      .from("ad_accounts")
      .select("id, external_account_id")
      .eq("organization_id", organizationId)
      .eq("platform", "tiktok")
      .eq("metadata->>hecom_cliente_id", hecomClienteId)
      .limit(150);
    for (const row of scopedAccounts ?? []) {
      const id = String(row.id ?? "").trim();
      const adv = String(row.external_account_id ?? "").trim();
      if (id) adAccountSet.add(id);
      if (adv) advertiserSet.add(adv);
    }
  }

  const scoped = Boolean(hecomClienteId) || advertiserSet.size > 0;

  if (scoped && advertiserSet.size === 0 && adAccountSet.size === 0) {
    return [];
  }

  const recentRejected = options?.recentRejected === true;
  const statusIn = (options?.statusIn ?? [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);

  const fetchLimit = recentRejected
    ? 40
    : typeof options?.limit === "number" && options.limit > 0
      ? Math.min(Math.floor(options.limit), 150)
      : scoped
        ? 150
        : 40;

  const scopeOr = (() => {
    if (!scoped) return "";
    const parts: string[] = [];
    if (advertiserSet.size > 0) {
      parts.push(
        `external_advertiser_id.in.(${[...advertiserSet].join(",")})`,
      );
    }
    if (adAccountSet.size > 0) {
      parts.push(`ad_account_id.in.(${[...adAccountSet].join(",")})`);
    }
    return parts.join(",");
  })();

  const LIST_COLUMNS =
    "id, status, brief, error_message, created_at, reviewed_at, published_at, creative_asset_id, ad_account_id, external_advertiser_id, review_status, reject_reasons, secondary_status, parent_draft_id, discover_source, external_ad_id, publish_result, reject_fix_hint";

  function draftQuery(columns: string) {
    let query = admin
      .from("creative_publish_drafts")
      .select(columns)
      .eq("organization_id", organizationId);
    if (recentRejected) {
      query = query.eq("status", "published").eq("review_status", "rejected");
    } else if (statusIn.length > 0) {
      query = query.in("status", statusIn);
    }
    if (scopeOr) query = query.or(scopeOr);
    if (recentRejected) {
      query = query
        .order("reviewed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }
    return query.limit(fetchLimit);
  }

  const { data: draftsRaw, error } = await draftQuery(LIST_COLUMNS);

  // Migraciones 030/031 aún no aplicadas: ir degradando el select.
  // Tipado laxo: cada fallback trae menos columnas.
  type DraftListRow = {
    id: string;
    status: string;
    brief: unknown;
    error_message: string | null;
    created_at: string;
    reviewed_at: string | null;
    published_at: string | null;
    creative_asset_id: string | null;
    ad_account_id: string | null;
    external_advertiser_id: string | null;
    review_status?: string | null;
    reject_reasons?: unknown;
    secondary_status?: string | null;
    parent_draft_id?: string | null;
    discover_source?: string | null;
    external_ad_id?: string | null;
    publish_result?: unknown;
    reject_fix_hint?: string | null;
  };
  let draftsSource = draftsRaw as DraftListRow[] | null;
  let listError = error;
  const columnsWithoutHint = LIST_COLUMNS.replace(", reject_fix_hint", "");
  if (listError && /reject_fix_hint/i.test(listError.message)) {
    const fallback = await draftQuery(columnsWithoutHint);
    draftsSource = (fallback.data ?? null) as DraftListRow[] | null;
    listError = fallback.error;
  }
  if (listError && /discover_source|external_ad_id/i.test(listError.message)) {
    const fallback = await draftQuery(
      "id, status, brief, error_message, created_at, reviewed_at, published_at, creative_asset_id, ad_account_id, external_advertiser_id, review_status, reject_reasons, secondary_status, parent_draft_id",
    );
    draftsSource = (fallback.data ?? null) as DraftListRow[] | null;
    listError = fallback.error;
  }
  if (listError && /parent_draft_id/i.test(listError.message)) {
    const fallback = await draftQuery(
      "id, status, brief, error_message, created_at, reviewed_at, published_at, creative_asset_id, ad_account_id, external_advertiser_id, review_status, reject_reasons, secondary_status",
    );
    draftsSource = (fallback.data ?? null) as DraftListRow[] | null;
    listError = fallback.error;
  }
  if (
    listError &&
    /review_status|reject_reasons|secondary_status/i.test(listError.message)
  ) {
    const fallback = await draftQuery(
      "id, status, brief, error_message, created_at, reviewed_at, published_at, creative_asset_id, ad_account_id, external_advertiser_id",
    );
    draftsSource = (fallback.data ?? null) as DraftListRow[] | null;
    listError = fallback.error;
  }

  if (listError || !draftsSource?.length) {
    if (listError) console.warn("[creatives] list_drafts", listError.message);
    return [];
  }

  const data = scoped
    ? draftsSource.filter((row) => {
        const accountId = String(row.ad_account_id ?? "").trim();
        const advertiserId = String(row.external_advertiser_id ?? "").trim();
        if (accountId && adAccountSet.has(accountId)) return true;
        if (advertiserId && advertiserSet.has(advertiserId)) return true;
        return false;
      })
    : draftsSource;

  if (!data.length) {
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
      ? admin
          .from("creative_assets")
          .select(
            "id, name, asset_type, mime_type, storage_bucket, storage_path, thumbnail_url, public_url",
          )
          .in("id", assetIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    accountIds.length
      ? admin.from("ad_accounts").select("id, name").in("id", accountIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const assetRows = (assetsRes.data ?? []) as Array<{
    id: string;
    name: string;
    asset_type?: string | null;
    mime_type?: string | null;
    storage_bucket?: string | null;
    storage_path?: string | null;
    thumbnail_url?: string | null;
    public_url?: string | null;
  }>;
  const assetName = new Map(assetRows.map((r) => [r.id, r.name]));
  const assetById = new Map(assetRows.map((r) => [r.id, r]));
  const signedDraftAssets = await signedUrlById(
    admin,
    assetRows.map((row) => ({
      id: row.id,
      bucket: row.storage_bucket ?? null,
      path: row.storage_path ?? null,
    })),
  );
  const accountName = new Map(
    (accountsRes.data ?? []).map((r) => [r.id, r.name]),
  );

  const parentLabelById = new Map<string, string>();
  for (const row of data) {
    const brief = (row.brief ?? {}) as Partial<CreativeAgentBrief>;
    const label =
      String(brief.campaignName ?? "").trim() ||
      (row.creative_asset_id
        ? assetName.get(row.creative_asset_id as string)
        : null) ||
      "Brief";
    parentLabelById.set(row.id as string, label);
  }

  const activeFixParents = new Set<string>();
  for (const row of data) {
    const parentId = String(
      (row as { parent_draft_id?: string | null }).parent_draft_id ?? "",
    ).trim();
    if (!parentId) continue;
    const st = String(row.status ?? "");
    if (
      st === "draft" ||
      st === "approved" ||
      st === "publishing" ||
      st === "published" ||
      st === "failed"
    ) {
      // Hijo rechazado de nuevo no cuenta como fix activo.
      const childReview = String(
        (row as { review_status?: string | null }).review_status ?? "",
      );
      if (st === "published" && childReview === "rejected") continue;
      activeFixParents.add(parentId);
    }
  }

  const mapped: CreativeDraftListItem[] = data.map((row) => {
    const brief = (row.brief ?? {}) as Partial<CreativeAgentBrief>;
    const rejectRaw = row.reject_reasons;
    const tiktokRejectReasons = Array.isArray(rejectRaw)
      ? rejectRaw.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const reviewRaw = String(row.review_status ?? "").trim();
    const tiktokReviewStatus = (
      ["pending", "approved", "rejected", "unknown"].includes(reviewRaw)
        ? reviewRaw
        : null
    ) as CreativeTikTokReviewStatus | null;
    const parentDraftId =
      String(
        (row as { parent_draft_id?: string | null }).parent_draft_id ?? "",
      ).trim() || null;
    const discoverRaw = String(
      (row as { discover_source?: string | null }).discover_source ?? "",
    ).trim();
    const discoverSource: CreativeDraftListItem["discoverSource"] =
      discoverRaw === "holistic"
        ? "holistic"
        : discoverRaw === "tiktok_ads_manager"
          ? "tiktok_ads_manager"
          : null;
    const publishResult =
      row.publish_result && typeof row.publish_result === "object"
        ? (row.publish_result as Record<string, unknown>)
        : {};
    const linked = row.creative_asset_id
      ? assetById.get(row.creative_asset_id as string)
      : undefined;
    const signed = row.creative_asset_id
      ? (signedDraftAssets.get(row.creative_asset_id as string) ?? null)
      : null;
    const posterUrl =
      httpUrl(publishResult.poster_url) ??
      httpUrl(linked?.thumbnail_url) ??
      (linked?.mime_type?.startsWith("image/") || linked?.asset_type === "image"
        ? signed
        : null);
    const previewUrl =
      httpUrl(publishResult.preview_url) ??
      signed ??
      httpUrl(linked?.public_url) ??
      posterUrl;

    const videoId =
      String(publishResult.video_id ?? "").trim() ||
      (Array.isArray(publishResult.image_ids)
        ? String(publishResult.image_ids[0] ?? "").trim()
        : "") ||
      null;

    return {
      id: row.id as string,
      status: row.status as CreativePublishDraftStatus,
      assetName: row.creative_asset_id
        ? (assetName.get(row.creative_asset_id as string) ?? null)
        : null,
      accountName: row.ad_account_id
        ? (accountName.get(row.ad_account_id as string) ?? null)
        : null,
      adAccountId: (row.ad_account_id as string | null) ?? null,
      externalAdvertiserId:
        (row.external_advertiser_id as string | null) ?? null,
      externalAdId:
        String(
          (row as { external_ad_id?: string | null }).external_ad_id ?? "",
        ).trim() || null,
      brief: slimBriefForList(brief),
      errorMessage: (row.error_message as string | null) ?? null,
      createdAt: row.created_at as string,
      reviewedAt: (row.reviewed_at as string | null) ?? null,
      publishedAt: (row.published_at as string | null) ?? null,
      tiktokReviewStatus,
      tiktokRejectReasons,
      rejectFixHint:
        String(
          (row as { reject_fix_hint?: string | null }).reject_fix_hint ?? "",
        ).trim() || null,
      tiktokSecondaryStatus:
        (row.secondary_status as string | null)?.trim() || null,
      parentDraftId,
      parentLabel: parentDraftId
        ? (parentLabelById.get(parentDraftId) ?? null)
        : null,
      hasActiveFix: activeFixParents.has(row.id as string),
      discoverSource,
      previewUrl,
      posterUrl,
      mediaKind: mediaKindFrom({
        mimeType: linked?.mime_type ?? null,
        assetType: linked?.asset_type ?? null,
        previewUrl,
        posterUrl,
      }),
      videoId,
    };
  });

  if (!recentRejected) return mapped;

  const seen = new Set<string>();
  const unique: CreativeDraftListItem[] = [];
  for (const item of mapped) {
    const name = cleanCreativeDisplayName(
      item.brief.adName || item.assetName || "",
    );
    const key = item.videoId || name.toLowerCase() || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 8) break;
  }
  return unique;
}
