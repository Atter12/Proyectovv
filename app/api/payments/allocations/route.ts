import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { allocateToAdAccount } from "@/lib/ledger/ledger.server";

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

  try {
    const journalId = await allocateToAdAccount({
      organizationId: session.organizationId,
      adAccountId: body.adAccountId,
      amountCents,
      idempotencyKey:
        body.idempotencyKey ??
        `allocation:${session.organizationId}:${body.adAccountId}:${amountCents}:${randomUUID()}`,
      description: body.description ?? "Asignación desde dashboard",
      metadata: {
        source: "dashboard",
        requested_by: session.id,
        currency: body.currency ?? "USD",
      },
    });

    return NextResponse.json({ ok: true, journalId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo asignar saldo.";
    const status = message.toLowerCase().includes("insufficient") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
