import type { SupabaseClient } from "@supabase/supabase-js";

/** Perfil activo + membresía de org: requisito para entrar al dashboard. */
export async function userCanAccessDashboard(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle<{ status: string }>();

  if (!profile || profile.status !== "active") return false;

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ organization_id: string }>();

  return Boolean(membership?.organization_id);
}
