import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { approveManualVoucherPayment } from "@/lib/payments/review-manual-payment.server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const caps = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!caps.isStaff && !caps.isSuperAdmin) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  let notes: string | null = null;
  let adjustedGrossChargeCents: number | null = null;
  let adjustedPeriodoResumen: string | null = null;
  try {
    const body = (await request.json()) as {
      notes?: string;
      adjustedGrossChargeCents?: number;
      adjustedAmount?: number;
      adjustedPeriodoResumen?: string;
      periodoResumen?: string;
    };
    notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    if (
      typeof body.adjustedGrossChargeCents === "number" &&
      Number.isFinite(body.adjustedGrossChargeCents) &&
      body.adjustedGrossChargeCents > 0
    ) {
      adjustedGrossChargeCents = Math.round(body.adjustedGrossChargeCents);
    } else if (
      typeof body.adjustedAmount === "number" &&
      Number.isFinite(body.adjustedAmount) &&
      body.adjustedAmount > 0
    ) {
      adjustedGrossChargeCents = Math.round(body.adjustedAmount * 100);
    }
    const periodoRaw =
      typeof body.adjustedPeriodoResumen === "string"
        ? body.adjustedPeriodoResumen
        : typeof body.periodoResumen === "string"
          ? body.periodoResumen
          : null;
    adjustedPeriodoResumen = periodoRaw?.trim() || null;
  } catch {
    notes = null;
  }

  try {
    const result = await approveManualVoucherPayment({
      paymentIntentId: id,
      actor: { id: session.id, email: session.email },
      notes,
      approvedFrom: "dashboard",
      adjustedGrossChargeCents,
      adjustedPeriodoResumen,
    });
    const isNonWallet =
      result.creditUsdCents === 0 && result.journalId === "";
    return NextResponse.json({
      ok: true,
      journalId: result.journalId,
      creditUsdCents: result.creditUsdCents,
      grossChargeCents: result.grossChargeCents,
      message: isNonWallet
        ? "Registrado. Si era Real Profit se activó COD; si era cobro faltante, ya figura en Lo pagado."
        : "Saldo disponible en cartera. El cliente ya puede asignar.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo aprobar el pago.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
