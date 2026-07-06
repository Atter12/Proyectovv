import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { updateAdAccount } from "@/services/ad-accounts.service";
import type { DbAdPlatform } from "@/types/database";

const VALID_PLATFORMS: DbAdPlatform[] = ["meta", "google", "tiktok", "linkedin", "other"];
const VALID_STATUSES = ["active", "pending", "disabled", "review"] as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseOptionalAmount(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "adAccounts:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  let body: {
    name?: string;
    platform?: DbAdPlatform;
    externalAccountId?: string | null;
    externalBusinessId?: string | null;
    externalAccountName?: string | null;
    timezone?: string;
    dailyBudget?: number;
    monthlyLimit?: number;
    autoRechargeEnabled?: boolean;
    rechargeThreshold?: number;
    status?: "active" | "pending" | "disabled" | "review";
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }
  if (body.platform !== undefined && !VALID_PLATFORMS.includes(body.platform)) {
    return NextResponse.json({ error: "Plataforma inválida." }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  try {
    const account = await updateAdAccount(session, id, {
      name: body.name,
      platform: body.platform,
      externalAccountId: body.externalAccountId,
      externalBusinessId: body.externalBusinessId,
      externalAccountName: body.externalAccountName,
      timezone: body.timezone,
      dailyBudget: parseOptionalAmount(body.dailyBudget),
      monthlyLimit: parseOptionalAmount(body.monthlyLimit),
      autoRechargeEnabled: body.autoRechargeEnabled,
      rechargeThreshold: parseOptionalAmount(body.rechargeThreshold),
      status: body.status,
    });
    return NextResponse.json({ ok: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar.";
    const status = message.includes("no encontrada") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
