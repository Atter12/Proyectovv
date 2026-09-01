import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { transferBetweenAdAccountsWithTikTok } from "@/lib/payments/transfer-between-ad-accounts.server";

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
    fromAdAccountId?: string;
    toAdAccountId?: string;
    amount?: number;
    idempotencyKey?: string;
    agencyBmFunding?: boolean;
    forceLedgerOnly?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.fromAdAccountId || !body.toAdAccountId) {
    return NextResponse.json(
      { error: "Cuenta origen y destino requeridas." },
      { status: 400 },
    );
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
  }

  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  const forceLedgerOnly = Boolean(body.forceLedgerOnly);
  if (forceLedgerOnly && !capabilities.isStaff && !capabilities.isSuperAdmin) {
    return NextResponse.json(
      { error: "Solo staff puede forzar transferencia solo-ledger." },
      { status: 403 },
    );
  }

  let wantsAgencyBm = false;
  if (capabilities.canAgencyBmFund) {
    wantsAgencyBm = capabilities.canSwitchFundingModes
      ? Boolean(body.agencyBmFunding)
      : true;
  }

  const amountCents = Math.round(amount * 100);

  try {
    const result = await transferBetweenAdAccountsWithTikTok({
      organizationId: session.organizationId,
      fromAdAccountId: body.fromAdAccountId,
      toAdAccountId: body.toAdAccountId,
      amountCents,
      requestedBy: session.id,
      agencyBmFunding: wantsAgencyBm,
      forceLedgerOnly,
      idempotencyKey:
        body.idempotencyKey ??
        `transfer:${session.organizationId}:${body.fromAdAccountId}:${body.toAdAccountId}:${amountCents}:${randomUUID()}`,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      amountUsd: result.amountCents / 100,
      requestedAmountUsd: result.requestedAmountCents / 100,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo transferir el saldo.";
    const lower = message.toLowerCase();
    const status =
      lower.includes("no tiene saldo") ||
      lower.includes("solo hay") ||
      lower.includes("elegí") ||
      lower.includes("suspendida")
        ? 409
        : lower.includes("tiktok") || lower.includes("cartera holistic")
          ? 502
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
