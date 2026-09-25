"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import { requireSession } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEducationLessonSlug } from "./lib/catalog";
import { canonicalLoomShareUrl } from "./lib/loom";

export type SaveEducationLoomResult =
  | { ok: true; loomUrl: string | null }
  | {
      ok: false;
      error: "forbidden" | "invalid" | "missing_table" | "unknown";
    };

export async function saveEducationLoomUrlAction(
  slug: string,
  loomUrl: string,
): Promise<SaveEducationLoomResult> {
  const session = await requireSession();
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const isAdmin = userIsAllowedAdmin({ id: session.id, email: session.email });
  if (!funding.isStaff && !funding.isSuperAdmin && !isAdmin) {
    return { ok: false, error: "forbidden" };
  }

  if (!isEducationLessonSlug(slug)) {
    return { ok: false, error: "invalid" };
  }

  const trimmed = loomUrl.trim();
  let stored: string | null = null;
  if (trimmed.length > 0) {
    stored = canonicalLoomShareUrl(trimmed);
    if (!stored) return { ok: false, error: "invalid" };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("education_lessons").upsert({
      slug,
      loom_url: stored,
      updated_by: session.id,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      const message = error.message.toLowerCase();
      const missing =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        message.includes("education_lessons");
      return { ok: false, error: missing ? "missing_table" : "unknown" };
    }
  } catch {
    return { ok: false, error: "unknown" };
  }

  revalidatePath(routes.education);
  revalidatePath(routes.adminEducation);
  return { ok: true, loomUrl: stored };
}
