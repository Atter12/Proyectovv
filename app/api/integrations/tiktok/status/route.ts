import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getTikTokConnectionStatus } from "@/lib/integrations/tiktok/client.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!hasPermission(session.permissions, "adAccounts:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  try {
    const status = await getTikTokConnectionStatus(session.organizationId);
    return NextResponse.json({
      ok: true,
      organizationId: session.organizationId,
      organizationName: session.organizationName,
      ...status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo consultar el estado de TikTok.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
