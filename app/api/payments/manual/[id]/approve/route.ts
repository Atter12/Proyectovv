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
  try {
    const body = (await request.json()) as { notes?: string };
    notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  } catch {
    notes = null;
  }

  try {
    const result = await approveManualVoucherPayment({
      paymentIntentId: id,
      actor: { id: session.id, email: session.email },
      notes,
      approvedFrom: "dashboard",
    });
    return NextResponse.json({
      ok: true,
      journalId: result.journalId,
      message: "Saldo disponible en cartera. El cliente ya puede asignar.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo aprobar el pago.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
