import "server-only";
import {
  buildReferralShareUrl,
  CLIENT_AFFILIATE_REWARD_USD,
  mapReferralSource,
  referralDisplayPath,
  resolveClientAffiliateView,
  selectLinkedAffiliateUserId,
  type ClientAffiliateProgramView,
  type ClientAffiliateReferral,
  type ReferralSource,
} from "@/features/affiliates/lib/client-program";
import { serverEnv } from "@/lib/env/env.server";
import { isRecord } from "@/lib/records";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
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

interface ViewedClientIdentity {
  userId: string;
  email: string | null;
  referralCode: string;
}

export async function getClientAffiliateProgram(
  session: SessionUser,
): Promise<ClientAffiliateProgramView> {
  const viewingAnotherClient = await getActingAsCliente(session.id);

  if (!viewingAnotherClient) {
    const program = await getAffiliateProgram(session);
    const shareUrl = buildReferralShareUrl(serverEnv.appUrl, program.referralCode);
    const liveReferrals = await loadLiveReferrals(session.id, false);
    return resolveClientAffiliateView({
      email: session.email,
      rewardUsd: CLIENT_AFFILIATE_REWARD_USD,
      referralCode: program.referralCode,
      shareUrl,
      displayPath: referralDisplayPath(shareUrl),
      liveReferrals,
      allowSmoke: true,
    });
  }

  const identity = await resolveViewedClientIdentity(session.id);
  const referralCode = identity?.referralCode ?? "pending";
  const shareUrl = buildReferralShareUrl(serverEnv.appUrl, referralCode);
  const liveReferrals = identity
    ? await loadLiveReferrals(identity.userId, true)
    : [];

  return resolveClientAffiliateView({
    email: identity?.email,
    rewardUsd: CLIENT_AFFILIATE_REWARD_USD,
    referralCode,
    shareUrl,
    displayPath: referralDisplayPath(shareUrl),
    liveReferrals,
    allowSmoke: false,
  });
}

/**
 * Ficha Hecom vista por un gerente: código y referidos del usuario OTP
 * de ese cliente. Si no hay cuenta vinculada, no se usa la del gerente.
 */
async function resolveViewedClientIdentity(
  viewerUserId: string,
): Promise<ViewedClientIdentity | null> {
  try {
    const selected = await getSelectedHecomCliente(viewerUserId);
    if (!selected) return null;

    const admin = createAdminClient();
    const { data: links } = await admin
      .from("hecom_cliente_user_links")
      .select("user_id, email")
      .eq("hecom_cliente_id", selected.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    const userId = selectLinkedAffiliateUserId(
      viewerUserId,
      (links ?? []).map((row) => String(row.user_id ?? "")),
    );
    if (!userId) return null;

    const link = (links ?? []).find((row) => String(row.user_id) === userId);
    const email = typeof link?.email === "string" ? link.email : null;
    const referralCode = await referralCodeForClientUser(userId, selected.name);

    return { userId, email, referralCode };
  } catch {
    return null;
  }
}

async function referralCodeForClientUser(
  userId: string,
  clienteName: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ organization_id: string }>();

  const organizationId = membership?.organization_id
    ? String(membership.organization_id)
    : "";

  const { data: codes } = await admin
    .from("referral_codes")
    .select("code, organization_id, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(8);

  const rows = codes ?? [];
  const forOrg = organizationId
    ? rows.find((row) => String(row.organization_id) === organizationId)
    : undefined;
  const existing = forOrg ?? rows[0];
  if (existing?.code) return String(existing.code);
  if (!organizationId) return "pending";

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null; email: string | null }>();

  const name =
    profile?.full_name?.trim() ||
    clienteName.trim() ||
    profile?.email?.split("@")[0] ||
    "ref";
  const code = `${slugReferralBase(name)}-${userId.slice(0, 6)}`;

  const inserted = await admin
    .from("referral_codes")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      code,
      status: "active",
    })
    .select("code")
    .maybeSingle<{ code: string }>();

  if (inserted.data?.code) return inserted.data.code;

  const { data: again } = await admin
    .from("referral_codes")
    .select("code")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ code: string }>();

  return again?.code ? String(again.code) : "pending";
}

function slugReferralBase(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "ref";
}

async function loadLiveReferrals(
  userId: string,
  useAdmin: boolean,
): Promise<ClientAffiliateReferral[]> {
  const rows = await queryReferrals(userId, useAdmin);
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

async function queryReferrals(
  userId: string,
  useAdmin: boolean,
): Promise<ReferralQueryRow[]> {
  const supabase = useAdmin ? createAdminClient() : await createClient();
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
