import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { MeetingError } from "@/features/support/lib/meetings.server";
import { isSupportStaff } from "@/features/support/lib/meeting-access.server";

export const runtime = "nodejs";

export async function requireSupportUser() {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 }),
    };
  }
  if (!hasPermission(session.permissions, "support:read")) {
    return {
      session: null,
      response: NextResponse.json({ ok: false, error: "Permiso denegado." }, { status: 403 }),
    };
  }
  return { session, response: null };
}

export async function requireSupportStaff() {
  const gate = await requireSupportUser();
  if (!gate.session || gate.response) return gate;
  if (!(await isSupportStaff(gate.session.email, gate.session.role))) {
    return {
      session: null,
      response: NextResponse.json({ ok: false, error: "Solo el equipo de soporte." }, { status: 403 }),
    };
  }
  return gate;
}

export function meetingErrorResponse(error: unknown) {
  if (error instanceof MeetingError) {
    const status =
      error.code === "forbidden"
        ? 403
        : error.code === "not_found"
          ? 404
          : error.code === "unavailable"
            ? 503
            : 400;
    return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status });
  }
  console.error("[support-meetings]", error);
  return NextResponse.json(
    { ok: false, code: "invalid", error: "No se pudo completar la acción." },
    { status: 500 },
  );
}
