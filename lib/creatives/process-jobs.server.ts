import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzeCreativeWithOpenAi,
  buildAgentBriefWithOpenAi,
  creativeAnalyzePromptVersion,
} from "@/lib/creatives/analyze-creative.server";
import type { CreativeAnalysisInsight } from "@/lib/creatives/types";

async function downloadAssetBuffer(input: {
  bucket: string;
  path: string;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(input.bucket)
    .download(input.path);
  if (error || !data) {
    console.error("[creative-jobs] download_failed", error?.message);
    return null;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const mimeType =
    (data as Blob & { type?: string }).type || "application/octet-stream";
  return { buffer, mimeType };
}

async function markJobFailed(jobId: string, message: string) {
  const admin = createAdminClient();
  await admin
    .from("creative_analysis_jobs")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function createAgentDraft(input: {
  organizationId: string;
  assetId: string;
  jobId: string;
  adAccountId: string | null;
  advertiserId: string | null;
  assetName: string;
  accountName: string | null;
  insight: CreativeAnalysisInsight;
  requestedBy: string | null;
}) {
  const brief = await buildAgentBriefWithOpenAi({
    assetName: input.assetName,
    insight: input.insight,
    advertiserName: input.accountName,
  });
  if (!brief) return;

  const admin = createAdminClient();
  await admin.from("creative_publish_drafts").insert({
    organization_id: input.organizationId,
    creative_asset_id: input.assetId,
    analysis_job_id: input.jobId,
    ad_account_id: input.adAccountId,
    external_advertiser_id: input.advertiserId,
    status: "draft",
    brief,
    requested_by: input.requestedBy,
  });
}

export async function processCreativeAnalysisJob(jobId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("creative_analysis_jobs")
    .select(
      "id, organization_id, creative_asset_id, status, requested_by, input",
    )
    .eq("id", jobId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      creative_asset_id: string | null;
      status: string;
      requested_by: string | null;
      input: Record<string, unknown> | null;
    }>();

  if (jobError || !job) {
    return { ok: false, error: jobError?.message ?? "Job no encontrado." };
  }
  if (job.status !== "queued" && job.status !== "pending") {
    return { ok: true };
  }
  if (!job.creative_asset_id) {
    await markJobFailed(job.id, "Job sin creative_asset_id.");
    return { ok: false, error: "Sin asset." };
  }

  await admin
    .from("creative_analysis_jobs")
    .update({
      status: "processing",
      provider: "openai",
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
      prompt_version: creativeAnalyzePromptVersion(),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", job.id);

  const { data: asset, error: assetError } = await admin
    .from("creative_assets")
    .select(
      "id, name, asset_type, mime_type, storage_bucket, storage_path, ad_account_id, external_advertiser_id",
    )
    .eq("id", job.creative_asset_id)
    .maybeSingle<{
      id: string;
      name: string;
      asset_type: string;
      mime_type: string | null;
      storage_bucket: string | null;
      storage_path: string | null;
      ad_account_id: string | null;
      external_advertiser_id: string | null;
    }>();

  if (assetError || !asset?.storage_bucket || !asset.storage_path) {
    await markJobFailed(job.id, "Asset sin archivo en storage.");
    return { ok: false, error: "Asset inválido." };
  }

  const downloaded = await downloadAssetBuffer({
    bucket: asset.storage_bucket,
    path: asset.storage_path,
  });
  if (!downloaded) {
    await markJobFailed(job.id, "No se pudo descargar el archivo.");
    return { ok: false, error: "Download failed." };
  }

  const insight = await analyzeCreativeWithOpenAi({
    buffer: downloaded.buffer,
    mimeType: asset.mime_type || downloaded.mimeType,
    assetName: asset.name,
    assetType: asset.asset_type,
  });

  if (!insight) {
    await markJobFailed(
      job.id,
      "No se pudo analizar con IA (revisá OPENAI_API_KEY).",
    );
    return { ok: false, error: "OpenAI failed." };
  }

  const { error: resultError } = await admin
    .from("creative_analysis_results")
    .upsert(
      {
        job_id: job.id,
        organization_id: job.organization_id,
        creative_asset_id: asset.id,
        overall_score: insight.overallScore,
        clarity_score: insight.clarityScore,
        brand_score: insight.brandScore,
        compliance_score: insight.complianceScore,
        recommendations: insight.recommendations,
        detected_issues: insight.policyRisks,
        raw_output: {
          summary: insight.summary,
          hooks: insight.hooks,
          policy_risks: insight.policyRisks,
          why_it_may_perform: insight.whyItMayPerform,
        },
        score: insight.overallScore,
        summary: insight.summary,
        signals: {
          hooks: insight.hooks,
          policy: insight.complianceScore,
        },
      },
      { onConflict: "job_id" },
    );

  if (resultError) {
    await markJobFailed(job.id, resultError.message);
    return { ok: false, error: resultError.message };
  }

  await admin
    .from("creative_analysis_jobs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await admin
    .from("creative_assets")
    .update({
      status: "analyzed",
      updated_at: new Date().toISOString(),
      metadata: {
        last_analysis_job_id: job.id,
        last_overall_score: insight.overallScore,
      },
    })
    .eq("id", asset.id);

  let accountName: string | null = null;
  if (asset.ad_account_id) {
    const { data: acc } = await admin
      .from("ad_accounts")
      .select("name")
      .eq("id", asset.ad_account_id)
      .maybeSingle<{ name: string }>();
    accountName = acc?.name ?? null;
  }

  await createAgentDraft({
    organizationId: job.organization_id,
    assetId: asset.id,
    jobId: job.id,
    adAccountId: asset.ad_account_id,
    advertiserId: asset.external_advertiser_id,
    assetName: asset.name,
    accountName,
    insight,
    requestedBy: job.requested_by,
  });

  return { ok: true };
}

export async function processQueuedCreativeJobs(input?: {
  limit?: number;
  jobId?: string;
}): Promise<{ processed: number; failed: number }> {
  if (input?.jobId) {
    const result = await processCreativeAnalysisJob(input.jobId);
    return { processed: result.ok ? 1 : 0, failed: result.ok ? 0 : 1 };
  }

  const admin = createAdminClient();
  const limit = Math.min(Math.max(input?.limit ?? 5, 1), 20);
  const { data: jobs } = await admin
    .from("creative_analysis_jobs")
    .select("id")
    .in("status", ["queued", "pending"])
    .order("created_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  let failed = 0;
  for (const row of jobs ?? []) {
    const result = await processCreativeAnalysisJob(row.id);
    if (result.ok) processed += 1;
    else failed += 1;
  }
  return { processed, failed };
}
