import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { disconnectTikTokConnection } from "@/lib/integrations/tiktok/client.server";
import type { Permission } from "@/types/auth";

function canManageTikTok(permissions: Permission[]): boolean {
  return (
    hasPermission(permissions, "settings:update") ||
    hasPermission(permissions, "adAccounts:create")
  );
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!canManageTikTok(session.permissions)) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  try {
    await disconnectTikTokConnection(session.organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo desconectar TikTok.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
