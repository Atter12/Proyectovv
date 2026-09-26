import { NextResponse } from "next/server";
import {
  mutateClientMeeting,
  mutateStaffMeeting,
} from "@/features/support/lib/meetings.server";
import { isSupportStaff } from "@/features/support/lib/meeting-access.server";
import { meetingErrorResponse, requireSupportUser } from "@/app/api/support/meetings/_lib";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireSupportUser();
  if (!gate.session) return gate.response;
  const { id } = await context.params;

  let body: {
    action?: string;
    meetUrl?: string;
    advisorEmail?: string;
    startsAt?: string;
    notes?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  try {
    const staff = await isSupportStaff(gate.session.email, gate.session.role);
    const action = body.action ?? "";
    const meeting = staff
      ? await mutateStaffMeeting({
          session: gate.session,
          id,
          action,
          meetUrl: body.meetUrl,
          advisorEmail: body.advisorEmail,
          startsAt: body.startsAt,
          notes: body.notes,
        })
      : await mutateClientMeeting({
          session: gate.session,
          id,
          action,
          startsAt: body.startsAt,
        });
    return NextResponse.json({ ok: true, meeting });
  } catch (error) {
    return meetingErrorResponse(error);
  }
}
