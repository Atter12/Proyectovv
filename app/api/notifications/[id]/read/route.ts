import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { markNotificationRead } from "@/services/notifications.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "notifications:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await markNotificationRead(session, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo marcar como leída.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
