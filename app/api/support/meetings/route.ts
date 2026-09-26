import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createClientMeeting,
  listClientMeetings,
  listStaffBoard,
  staffCountsOnly,
} from "@/features/support/lib/meetings.server";
import { isSupportStaff } from "@/features/support/lib/meeting-access.server";
import {
  meetingErrorResponse,
  requireSupportUser,
} from "@/app/api/support/meetings/_lib";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireSupportUser();
  if (!gate.session) return gate.response;
  const staff = await isSupportStaff(gate.session.email, gate.session.role);

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "counts") {
      if (!staff) {
        return NextResponse.json({ ok: false, error: "Solo el equipo de soporte." }, { status: 403 });
      }
      const counts = await staffCountsOnly();
      return NextResponse.json({ ok: true, counts });
    }
    if (staff) {
      const board = await listStaffBoard();
      return NextResponse.json({ ok: true, ...board });
    }
    const meetings = await listClientMeetings(gate.session.id);
    return NextResponse.json({ ok: true, meetings });
  } catch (error) {
    return meetingErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireSupportUser();
  if (!gate.session) return gate.response;
  if (!hasPermission(gate.session.permissions, "support:create")) {
    return NextResponse.json({ ok: false, error: "Permiso denegado." }, { status: 403 });
  }

  let body: {
    startsAt?: string;
    subject?: string;
    notes?: string;
    phone?: string;
    meetingType?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  try {
    const meeting = await createClientMeeting({
      session: gate.session,
      startsAt: body.startsAt ?? "",
      subject: body.subject ?? "",
      notes: body.notes ?? "",
      phone: body.phone ?? "",
      meetingType: body.meetingType ?? "",
    });
    return NextResponse.json({ ok: true, meeting });
  } catch (error) {
    return meetingErrorResponse(error);
  }
}
