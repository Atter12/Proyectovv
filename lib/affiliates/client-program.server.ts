import "server-only";
import {
  buildReferralShareUrl,
  CLIENT_AFFILIATE_REWARD_USD,
  mapReferralSource,
  referralDisplayPath,
  resolveClientAffiliateView,
  type ClientAffiliateProgramView,
  type ClientAffiliateReferral,
  type ReferralSource,
} from "@/features/affiliates/lib/client-program";
import { serverEnv } from "@/lib/env/env.server";
import { isRecord } from "@/lib/records";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAffiliateProgram } from "@/services/affiliates.service";
import type { SessionUser } from "@/types/auth";

interface ReferralQueryRow {
  id: string;
  status: string;
  commission_amount_cents: number | null;
  created_at: string;
  paid_at?: string | null;
  referred_organization_id: string | null;
  metadata: unknown;
}

interface OrganizationQueryRow {
  id: string;
  name: string | null;
  billing_email: string | null;
}

export async function getClientAffiliateProgram(
  session: SessionUser,
): Promise<ClientAffiliateProgramView> {
  const program = await getAffiliateProgram(session);
  const shareUrl = buildReferralShareUrl(serverEnv.appUrl, program.referralCode);
  const liveReferrals = await loadLiveReferrals(session.id);

  return resolveClientAffiliateView({
    email: session.email,
    rewardUsd: CLIENT_AFFILIATE_REWARD_USD,
    referralCode: program.referralCode,
    shareUrl,
    displayPath: referralDisplayPath(shareUrl),
    liveReferrals,
  });
}

async function loadLiveReferrals(userId: string): Promise<ClientAffiliateReferral[]> {
  const rows = await queryReferrals(userId);
  if (rows.length === 0) return [];

  const orgIds = [
    ...new Set(
      rows
        .map((row) => row.referred_organization_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const organizations = await queryOrganizations(orgIds);

  return rows.map((row) => {
    const org = row.referred_organization_id
      ? organizations.get(row.referred_organization_id)
      : undefined;
    const source: ReferralSource = {
      id: row.id,
      status: row.status,
      commissionAmountCents: Number(row.commission_amount_cents ?? 0),
      createdAt: row.created_at,
      paidAt: row.paid_at ?? null,
      metadata: isRecord(row.metadata) ? row.metadata : null,
      organizationName: org?.name ?? null,
      organizationEmail: org?.billing_email ?? null,
    };
    return mapReferralSource(source, CLIENT_AFFILIATE_REWARD_USD);
  });
}

async function queryReferrals(userId: string): Promise<ReferralQueryRow[]> {
  const supabase = await createClient();
  const full = await supabase
    .from("referrals")
    .select(
      "id, status, commission_amount_cents, created_at, paid_at, referred_organization_id, metadata",
    )
    .eq("referrer_user_id", userId)
    .order("created_at", { ascending: false });

  if (!full.error) return (full.data ?? []) as ReferralQueryRow[];

  const fallback = await supabase
    .from("referrals")
    .select(
      "id, status, commission_amount_cents, created_at, referred_organization_id, metadata",
    )
    .eq("referrer_user_id", userId)
    .order("created_at", { ascending: false });

  if (fallback.error) return [];
  return (fallback.data ?? []) as ReferralQueryRow[];
}

async function queryOrganizations(
  ids: string[],
): Promise<Map<string, OrganizationQueryRow>> {
  const map = new Map<string, OrganizationQueryRow>();
  if (ids.length === 0) return map;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, billing_email")
      .in("id", ids);
    if (error || !data) return map;
    for (const row of data as OrganizationQueryRow[]) {
      map.set(row.id, row);
    }
  } catch {
    return map;
  }

  return map;
}
