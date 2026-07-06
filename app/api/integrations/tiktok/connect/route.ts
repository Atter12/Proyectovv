import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { buildTikTokAuthorizationUrl } from "@/lib/integrations/tiktok/oauth.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!hasPermission(session.permissions, "settings:update")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  try {
    const url = buildTikTokAuthorizationUrl({
      organizationId: session.organizationId,
      userId: session.id,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar TikTok OAuth.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
