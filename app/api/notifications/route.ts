import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { listNotifications } from "@/services/notifications.service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "notifications:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const notifications = await listNotifications(session);
  return NextResponse.json({ ok: true, notifications });
}
