import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { allocateWithOptionalTikTokFunding } from "@/lib/payments/allocate-with-tiktok.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!hasPermission(session.permissions, "payments:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  let body: {
    adAccountId?: string;
    amount?: number;
    currency?: string;
    idempotencyKey?: string;
    description?: string;
    agencyBmFunding?: boolean;
    crossBmFunding?: boolean;
    crossBmSourceBcId?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.adAccountId) {
    return NextResponse.json({ error: "Cuenta publicitaria requerida." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
  }

  const amountCents = Math.round(amount * 100);
  const actingAsCliente = await getActingAsCliente(session.id);
  const capabilities = withActAsClienteView(
    resolvePaymentsFundingCapabilities({
      email: session.email,
      role: session.role,
    }),
    actingAsCliente,
  );

  // Gerente → siempre BM. Super admin → según flag. Cliente / “ver como” → cartera Holistic.
  let wantsAgencyBm = false;
  if (capabilities.canAgencyBmFund) {
    wantsAgencyBm = capabilities.canSwitchFundingModes
      ? Boolean(body.agencyBmFunding)
      : true;
  }

  if (wantsAgencyBm && !capabilities.canAgencyBmFund) {
    return NextResponse.json(
      { error: "Solo gerentes/staff pueden recargar desde el BM sin recarga del cliente." },
      { status: 403 },
    );
  }

  // Org de la cuenta ads (cartera del cliente OTP), no la org del staff al “ver como”.
  const admin = createAdminClient();
  const { data: accountRow, error: accountError } = await admin
    .from("ad_accounts")
    .select("id, organization_id")
    .eq("id", body.adAccountId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }
  if (!accountRow?.organization_id) {
    return NextResponse.json(
      { error: "Cuenta publicitaria no encontrada." },
      { status: 404 },
    );
  }

  const organizationId = accountRow.organization_id;

  console.info("[payments/allocations]", {
    email: session.email,
    isStaff: capabilities.isStaff,
    isSuperAdmin: capabilities.isSuperAdmin,
    actingAsCliente,
    wantsAgencyBm,
    amountCents,
    adAccountId: body.adAccountId,
    organizationId,
    sessionOrg: session.organizationId,
    bodyFlag: body.agencyBmFunding ?? null,
  });

  try {
    const result = await allocateWithOptionalTikTokFunding({
      organizationId,
      adAccountId: body.adAccountId,
      amountCents,
      requestedBy: session.id,
      currency: body.currency ?? "USD",
      agencyBmFunding: wantsAgencyBm,
      crossBmFunding: wantsAgencyBm ? Boolean(body.crossBmFunding) : false,
      crossBmSourceBcId: body.crossBmSourceBcId,
      idempotencyKey:
        body.idempotencyKey ??
        `allocation:${organizationId}:${body.adAccountId}:${amountCents}:${randomUUID()}`,
      description: wantsAgencyBm
        ? body.description ?? "Recarga gerente desde BM TikTok"
        : body.description ?? "Asignación desde dashboard",
    });

    return NextResponse.json({
      ok: true,
      journalId: result.journalId,
      agencyBmFunding: result.agencyBmFunding,
      tiktokTransfer: result.tiktokTransfer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo asignar saldo.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("insufficient") || lower.includes("falta")
        ? 409
        : lower.includes("tiktok bc transfer")
          ? 502
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
