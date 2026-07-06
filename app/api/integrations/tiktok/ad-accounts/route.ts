import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  importTikTokAdvertiserAccounts,
  listTikTokAdvertiserAccounts,
} from "@/lib/integrations/tiktok/client.server";

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
    const accounts = await listTikTokAdvertiserAccounts(session.organizationId);
    return NextResponse.json({ ok: true, accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo listar TikTok.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!hasPermission(session.permissions, "adAccounts:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  try {
    const result = await importTikTokAdvertiserAccounts({
      organizationId: session.organizationId,
      userId: session.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar TikTok.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
