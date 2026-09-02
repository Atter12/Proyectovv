import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { rejectManualVoucherPayment } from "@/lib/payments/review-manual-payment.server";

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
  let reason = "Comprobante rechazado por revisión.";
  try {
    const body = (await request.json()) as { reason?: string };
    if (typeof body.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim();
    }
  } catch {
    /* default reason */
  }

  try {
    await rejectManualVoucherPayment({
      paymentIntentId: id,
      actor: { id: session.id, email: session.email },
      reason,
      rejectedFrom: "dashboard",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo rechazar el pago.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
