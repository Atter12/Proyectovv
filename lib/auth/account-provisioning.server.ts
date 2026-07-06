import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";

interface ProvisioningResult {
  ready: boolean;
  organizationId?: string;
  error?: string;
}

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base || "org"}-${suffix}`;
}

function getFullName(user: User): string {
  return (
    getMetadataString(user.user_metadata, "full_name") ||
    user.email?.split("@")[0] ||
    "Usuario"
  );
}

function getOrganizationName(user: User): string {
  return (
    getMetadataString(user.user_metadata, "organization_name") ||
    "Mi organización"
  );
}

async function ensureProfile(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
): Promise<{ ok: boolean; error?: string }> {
  const fullName = getFullName(user);
  const email = user.email ?? "";

  const profilePayload = {
    id: user.id,
    email,
    full_name: fullName,
    status: "active",
    email_verified: true,
    onboarding_status: "completed",
  };

  const { error: upsertError } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (!upsertError) return { ok: true };

  // Fallback para esquemas donde onboarding_status aún no existe o tiene otros valores.
  const { error: fallbackError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
      status: "active",
      email_verified: true,
    },
    { onConflict: "id" },
  );

  if (!fallbackError) return { ok: true };

  return { ok: false, error: fallbackError.message || upsertError.message };
}

async function findActiveMembership(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ organization_id: string }>();

  return data?.organization_id ?? null;
}

async function createOrganization(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
): Promise<{ id?: string; error?: string }> {
  const name = getOrganizationName(user);
  const slug = slugify(name);

  const { data, error } = await admin
    .from("organizations")
    .insert({ name, slug, created_by: user.id })
    .select("id")
    .single<{ id: string }>();

  if (!error) return { id: data.id };

  // Fallback para instalaciones que todavía no tienen created_by.
  const fallback = await admin
    .from("organizations")
    .insert({ name, slug })
    .select("id")
    .single<{ id: string }>();

  if (fallback.error) return { error: fallback.error.message || error.message };
  return { id: fallback.data.id };
}

async function createMembership(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.from("organization_memberships").insert({
    organization_id: organizationId,
    user_id: userId,
    role: "owner",
    status: "active",
  });

  if (!error) return { ok: true };

  // Fallback si el enum app_role no incluye owner.
  const fallback = await admin.from("organization_memberships").insert({
    organization_id: organizationId,
    user_id: userId,
    role: "advertiser",
    status: "active",
  });

  if (fallback.error) return { ok: false, error: fallback.error.message || error.message };
  return { ok: true };
}

async function ensureWallet(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
): Promise<void> {
  const { data: existingWallet } = await admin
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingWallet?.id) return;

  const { error } = await admin.from("wallets").insert({
    organization_id: organizationId,
    name: "Cartera Default",
    balance_cents: 0,
    currency: "USD",
    status: "active",
  });

  if (!error) return;

  // Fallback para esquemas antiguos con balance decimal.
  await admin.from("wallets").insert({
    organization_id: organizationId,
    name: "Cartera Default",
    balance: 0,
    currency: "USD",
    status: "active",
  });
}


async function recordReferralAttribution(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
  organizationId: string,
): Promise<void> {
  const referralCode = getMetadataString(user.user_metadata, "referral_code");
  if (!referralCode) return;

  const { data: codeRow, error } = await admin
    .from("referral_codes")
    .select("id, user_id, organization_id, code")
    .eq("code", referralCode)
    .eq("status", "active")
    .maybeSingle<{
      id: string;
      user_id: string;
      organization_id: string;
      code: string;
    }>();

  if (error || !codeRow) return;
  if (codeRow.user_id === user.id || codeRow.organization_id === organizationId) {
    return;
  }

  const { data: existingReferral } = await admin
    .from("referrals")
    .select("id")
    .eq("referred_organization_id", organizationId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingReferral?.id) return;

  const { error: insertError } = await admin.from("referrals").insert({
    referral_code_id: codeRow.id,
    referrer_user_id: codeRow.user_id,
    referred_organization_id: organizationId,
    status: "active",
    commission_rate: 0,
    commission_amount_cents: 0,
    metadata: {
      source: "registration",
      referral_code: codeRow.code,
      referred_user_id: user.id,
      referred_email: user.email ?? null,
    },
  });

  if (insertError) return;

  await createNotificationBestEffort({
    organizationId: codeRow.organization_id,
    userId: codeRow.user_id,
    title: "Nuevo referido registrado",
    body: `${getFullName(user)} creó una cuenta con tu enlace de referido.`,
    type: "affiliate_referral_registered",
    data: {
      url: "/affiliates",
      referred_organization_id: organizationId,
      referral_code: codeRow.code,
    },
  });
}

async function writeBestEffortAuditLog(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action: "organization.created",
    entity_type: "organization",
    entity_id: organizationId,
    metadata: { source: "account_setup" },
  });

  if (!error) return;

  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: userId,
    action: "organization.created",
    resource_type: "organization",
    resource_id: organizationId,
    metadata: { source: "account_setup" },
  });
}

export async function ensureAccountProvisionedForUser(
  user: User,
): Promise<ProvisioningResult> {
  if (!user.email_confirmed_at) {
    return { ready: false, error: "El correo aún no está verificado." };
  }

  try {
    const admin = createAdminClient();

    const profile = await ensureProfile(admin, user);
    if (!profile.ok) {
      return {
        ready: false,
        error: `No se pudo crear/actualizar el perfil: ${profile.error}`,
      };
    }

    const existingOrganizationId = await findActiveMembership(admin, user.id);
    if (existingOrganizationId) {
      await ensureWallet(admin, existingOrganizationId);
      return { ready: true, organizationId: existingOrganizationId };
    }

    const organization = await createOrganization(admin, user);
    if (!organization.id) {
      return {
        ready: false,
        error: `No se pudo crear la organización: ${organization.error}`,
      };
    }

    const membership = await createMembership(admin, organization.id, user.id);
    if (!membership.ok) {
      return {
        ready: false,
        error: `No se pudo crear la membresía: ${membership.error}`,
      };
    }

    await ensureWallet(admin, organization.id);
    await writeBestEffortAuditLog(admin, organization.id, user.id);
    await recordReferralAttribution(admin, user, organization.id);

    return { ready: true, organizationId: organization.id };
  } catch (error) {
    return {
      ready: false,
      error:
        error instanceof Error
          ? error.message
          : "Error inesperado preparando la cuenta.",
    };
  }
}
