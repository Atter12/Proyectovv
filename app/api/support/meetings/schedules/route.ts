import { NextResponse } from "next/server";
import { updateAdvisorSchedule } from "@/features/support/lib/meetings.server";
import {
  meetingErrorResponse,
  requireSupportStaff,
} from "@/app/api/support/meetings/_lib";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const gate = await requireSupportStaff();
  if (!gate.session) return gate.response;

  let body: {
    email?: string;
    displayName?: string;
    weekdayMask?: number;
    startMinute?: number;
    endMinute?: number;
    breakStartMinute?: number;
    breakEndMinute?: number;
    isAvailable?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  try {
    const schedule = await updateAdvisorSchedule({
      email: body.email ?? "",
      displayName: body.displayName ?? "",
      weekdayMask: Number(body.weekdayMask),
      startMinute: Number(body.startMinute),
      endMinute: Number(body.endMinute),
      breakStartMinute: Number(body.breakStartMinute),
      breakEndMinute: Number(body.breakEndMinute),
      isAvailable: Boolean(body.isAvailable),
    });
    return NextResponse.json({ ok: true, schedule });
  } catch (error) {
    return meetingErrorResponse(error);
  }
}
