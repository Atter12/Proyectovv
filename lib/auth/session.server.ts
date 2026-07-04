import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { getPermissionsForRole } from "@/lib/auth/permissions";
import { getAvatarInitials } from "@/lib/auth/utils";
import { createClient } from "@/lib/supabase/server";
import type {
  OrganizationMembershipRow,
  OrganizationRow,
  ProfileRow,
  SessionUser,
} from "@/types/auth";

function resolveOrganization(
  membership: OrganizationMembershipRow,
): OrganizationRow | null {
  const org = membership.organizations;
  if (!org) return null;
  return Array.isArray(org) ? (org[0] ?? null) : org;
}

function getUserMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const emailConfirmed = Boolean(user.email_confirmed_at);

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, avatar_url, phone, status, email_verified, onboarding_status, last_active_at, created_at, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const fullName =
    profile?.full_name?.trim() ||
    getUserMetadataValue(user.user_metadata, "full_name") ||
    user.email?.split("@")[0] ||
    "Usuario";

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select(
      "id, organization_id, user_id, role, status, invited_by, created_at, updated_at, organizations(id, name, slug, legal_name, tax_id, website_url, logo_url, status, created_by, created_at, updated_at)",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<OrganizationMembershipRow>();

  const organization = membership ? resolveOrganization(membership) : null;
  const role = membership?.role ?? "viewer";

  return {
    id: user.id,
    name: fullName,
    email: profile?.email ?? user.email ?? "",
    avatarInitials: getAvatarInitials(fullName),
    role,
    permissions: getPermissionsForRole(role),
    companyId: membership?.organization_id ?? "",
    organizationId: membership?.organization_id ?? "",
    organizationName: organization?.name ?? "",
    emailConfirmed,
    profileStatus: profile?.status ?? "email_pending",
  };
}

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireVerifiedSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect(routes.login);
  }

  if (!session.emailConfirmed) {
    const verifyUrl = `${routes.verifyOtp}?email=${encodeURIComponent(session.email)}`;
    redirect(verifyUrl);
  }

  if (session.profileStatus !== "active" || !session.organizationId) {
    redirect(routes.accountSetup);
  }

  return session;
}
