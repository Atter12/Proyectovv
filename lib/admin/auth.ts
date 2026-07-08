import "server-only";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";

export interface AdminSession {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  accessMode: "allowlist" | "development-open";
}

export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  if (!userIsAllowedAdmin({ id: user.id, email: user.email })) return null;

  let fullName: string | null = null;
  let avatarUrl: string | null = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; avatar_url: string | null }>();
    fullName = data?.full_name ?? null;
    avatarUrl = data?.avatar_url ?? null;
  } catch {
    // The session is still valid even if profile enrichment fails.
  }

  return {
    id: user.id,
    email: user.email,
    fullName,
    avatarUrl,
    accessMode:
      serverEnv.adminAllowedEmails.length === 0 && serverEnv.adminAllowedUserIds.length === 0
        ? "development-open"
        : "allowlist",
  };
}

export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(routes.adminLogin);

  const admin = await getCurrentAdmin();
  if (!admin) redirect(routes.adminUnauthorized);
  return admin;
}
