import { serverEnv } from "@/lib/env/env.server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { centsToAmount } from "@/lib/services/mappers";
import type { SessionUser } from "@/types/auth";
import type { DbReferralCodeRow, DbReferralRow } from "@/types/database";
import type { AffiliateProgramOverview } from "@/types/affiliate";
import { affiliatesMock } from "@/mocks/affiliates.mock";

export async function getAffiliateProgram(
  session: SessionUser,
): Promise<AffiliateProgramOverview> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyAffiliateProgram();
  }

  const supabase = await createClient();
  const initialCode = await supabase
    .from("referral_codes")
    .select("id, organization_id, user_id, code, status")
    .eq("organization_id", organizationId)
    .eq("user_id", session.id)
    .eq("status", "active")
    .maybeSingle<DbReferralCodeRow>();

  const ensuredCode = initialCode.data
    ? initialCode.data
    : (await ensureReferralCode(session, organizationId)).data;

  const code = ensuredCode?.code ?? "pending";
  const baseUrl = serverEnv.appUrl.replace(/\/$/, "");
  const referralUrl = `${baseUrl}/register?ref=${encodeURIComponent(code)}`;

  const { data: referrals } = await supabase
    .from("referrals")
    .select("id, referral_code_id, referrer_user_id, referred_organization_id, status, commission_rate, commission_amount_cents, created_at, converted_at")
    .eq("referrer_user_id", session.id);

  const referralRows = (referrals ?? []) as DbReferralRow[];
  const activeReferrals = referralRows.filter((r) =>
    ["active", "converted"].includes(r.status),
  ).length;
  const estimatedCommission = referralRows.reduce(
    (sum, row) => sum + Number(row.commission_amount_cents ?? 0),
    0,
  );
  const paidCommission = referralRows
    .filter((row) => row.status === "converted")
    .reduce((sum, row) => sum + Number(row.commission_amount_cents ?? 0), 0);

  return {
    referralCode: code,
    referralUrl,
    stats: {
      totalReferrals: referralRows.length,
      activeReferrals,
      estimatedCommission: centsToAmount(estimatedCommission),
      paidCommission: centsToAmount(paidCommission),
      clicks: 0,
      registrations: referralRows.length,
    },
    selectedBannerSize: "300x250",
    bannerSizes: affiliatesMock.bannerSizes,
    milestones: affiliatesMock.milestones,
    steps: affiliatesMock.steps,
    notes: affiliatesMock.notes,
  };
}

async function ensureReferralCode(
  session: SessionUser,
  organizationId: string,
): Promise<{ data: DbReferralCodeRow | null; error: Error | null }> {
  const admin = createAdminClient();
  const base = session.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const code = `${base || "ref"}-${session.id.slice(0, 6)}`;
  const { data, error } = await admin
    .from("referral_codes")
    .insert({
      organization_id: organizationId,
      user_id: session.id,
      code,
      status: "active",
    })
    .select("id, organization_id, user_id, code, status")
    .single<DbReferralCodeRow>();

  if (error?.code === "23505") {
    const supabase = await createClient();
    const existing = await supabase
      .from("referral_codes")
      .select("id, organization_id, user_id, code, status")
      .eq("organization_id", organizationId)
      .eq("user_id", session.id)
      .maybeSingle<DbReferralCodeRow>();
    return { data: existing.data, error: existing.error };
  }

  return { data: data ?? null, error: error ? new Error(error.message) : null };
}

function emptyAffiliateProgram(): AffiliateProgramOverview {
  return {
    referralCode: "—",
    referralUrl: `${serverEnv.appUrl}/register`,
    stats: {
      totalReferrals: 0,
      activeReferrals: 0,
      estimatedCommission: 0,
      paidCommission: 0,
      clicks: 0,
      registrations: 0,
    },
    selectedBannerSize: "300x250",
    bannerSizes: affiliatesMock.bannerSizes,
    milestones: affiliatesMock.milestones,
    steps: affiliatesMock.steps,
    notes: affiliatesMock.notes,
  };
}
