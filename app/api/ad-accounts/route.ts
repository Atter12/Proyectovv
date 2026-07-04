import { NextResponse } from "next/server";
import { createAdAccount } from "@/services/ad-accounts.service";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import type { DbAdPlatform } from "@/types/database";

const VALID_PLATFORMS: DbAdPlatform[] = [
  "meta",
  "google",
  "tiktok",
  "linkedin",
  "other",
];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "adAccounts:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { getAdAccountsOverview } = await import("@/services/ad-accounts.service");
  const data = await getAdAccountsOverview(session);
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "adAccounts:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  let body: {
    name?: string;
    platform?: DbAdPlatform;
    externalAccountId?: string;
    timezone?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const platform = body.platform ?? "meta";
  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Plataforma inválida." }, { status: 400 });
  }

  try {
    const account = await createAdAccount(session, {
      name,
      platform,
      externalAccountId: body.externalAccountId,
      timezone: body.timezone,
    });
    return NextResponse.json({ ok: true, account });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cuenta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
