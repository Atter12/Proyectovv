import { NextResponse } from "next/server";
import { getAvailability } from "@/features/support/lib/meetings.server";
import { isSupportStaff } from "@/features/support/lib/meeting-access.server";
import { meetingErrorResponse, requireSupportUser } from "@/app/api/support/meetings/_lib";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireSupportUser();
  if (!gate.session) return gate.response;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const days = Number(url.searchParams.get("days") ?? "7");
  const ignore = url.searchParams.get("ignore");

  try {
    let ignoreId: string | null = null;
    if (ignore) {
      const staff = await isSupportStaff(gate.session.email, gate.session.role);
      if (!staff) {
        const { data } = await createAdminClient()
          .from("support_meetings")
          .select("id, requester_user_id")
          .eq("id", ignore)
          .maybeSingle();
        if (!data || data.requester_user_id !== gate.session.id) {
          return NextResponse.json({ ok: false, error: "Permiso denegado." }, { status: 403 });
        }
      }
      ignoreId = ignore;
    }
    const availability = await getAvailability({
      fromYmd: from,
      dayCount: Number.isFinite(days) ? days : 7,
      ignoreId,
    });
    return NextResponse.json({ ok: true, timezone: "America/Lima", ...availability });
  } catch (error) {
    return meetingErrorResponse(error);
  }
}
