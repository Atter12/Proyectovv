import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { allocateWithOptionalTikTokFunding } from "@/lib/payments/allocate-with-tiktok.server";

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
  const isStaff =
    isHecomOtpStaffEmail(session.email) ||
    session.role === "owner" ||
    session.role === "admin";
  // Producto: gerentes siempre fondean desde BM. Stripe es solo recarga de clientes.
  const wantsAgencyBm = isStaff || Boolean(body.agencyBmFunding);

  if (wantsAgencyBm && !isStaff) {
    return NextResponse.json(
      { error: "Solo gerentes/staff pueden fondear desde el BM sin recarga del cliente." },
      { status: 403 },
    );
  }

  console.info("[payments/allocations]", {
    email: session.email,
    isStaff,
    wantsAgencyBm,
    amountCents,
    adAccountId: body.adAccountId,
    bodyFlag: body.agencyBmFunding ?? null,
  });

  try {
    const result = await allocateWithOptionalTikTokFunding({
      organizationId: session.organizationId,
      adAccountId: body.adAccountId,
      amountCents,
      requestedBy: session.id,
      currency: body.currency ?? "USD",
      agencyBmFunding: wantsAgencyBm,
      idempotencyKey:
        body.idempotencyKey ??
        `allocation:${session.organizationId}:${body.adAccountId}:${amountCents}:${randomUUID()}`,
      description: wantsAgencyBm
        ? body.description ?? "Fondeo gerente desde BM TikTok"
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
