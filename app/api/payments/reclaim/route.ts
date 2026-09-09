import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reclaimFromAdAccountWithTikTok } from "@/lib/payments/reclaim-with-tiktok.server";

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
    forceLedgerOnly?: boolean;
    idempotencyKey?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.adAccountId) {
    return NextResponse.json({ error: "Cuenta publicitaria requerida." }, { status: 400 });
  }

  const amount =
    body.amount === undefined || body.amount === null
      ? undefined
      : Number(body.amount);
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
  }

  const actingAsCliente = await getActingAsCliente(session.id);
  const capabilities = withActAsClienteView(
    resolvePaymentsFundingCapabilities({
      email: session.email,
      role: session.role,
    }),
    actingAsCliente,
  );
  const forceLedgerOnly = Boolean(body.forceLedgerOnly);
  if (forceLedgerOnly && !capabilities.isStaff && !capabilities.isSuperAdmin) {
    return NextResponse.json(
      { error: "Solo staff puede forzar recuperación solo-ledger." },
      { status: 403 },
    );
  }

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
  const amountCents =
    amount === undefined ? undefined : Math.round(amount * 100);

  console.info("[payments/reclaim]", {
    email: session.email,
    actingAsCliente,
    amountCents: amountCents ?? "all",
    adAccountId: body.adAccountId,
    organizationId,
    sessionOrg: session.organizationId,
  });

  try {
    const result = await reclaimFromAdAccountWithTikTok({
      organizationId,
      adAccountId: body.adAccountId,
      amountCents,
      requestedBy: session.id,
      forceLedgerOnly,
      idempotencyKey:
        body.idempotencyKey ??
        `reclaim:${organizationId}:${body.adAccountId}:${amountCents ?? "all"}:${randomUUID()}`,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      amountUsd: result.amountCents / 100,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo recuperar el saldo.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("no tiene saldo") ||
      lower.includes("solo hay") ||
      lower.includes("no encontrada")
        ? 409
        : lower.includes("tiktok")
          ? 502
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
