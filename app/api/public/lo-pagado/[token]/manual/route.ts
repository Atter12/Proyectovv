import { NextResponse } from "next/server";
import {
  createPublicManualIntent,
  PublicLoPagadoError,
  resolvePublicLoPagado,
} from "@/lib/payments/public-lo-pagado.server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ctx = await resolvePublicLoPagado(token);
  if (!ctx) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }

  let body: { amount?: number; chargeCurrency?: string; periodoResumen?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const created = await createPublicManualIntent({
      ctx,
      amount: Number(body.amount),
      chargeCurrency: body.chargeCurrency === "PEN" ? "PEN" : "USD",
      periodoResumen: String(body.periodoResumen ?? ""),
    });
    return NextResponse.json({
      ok: true,
      paymentIntent: {
        paymentIntentId: created.paymentIntentId,
        grossChargeCents: created.grossChargeCents,
        chargeCurrency: created.chargeCurrency,
      },
    });
  } catch (error) {
    const message =
      error instanceof PublicLoPagadoError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo crear el pago.";
    const status = error instanceof PublicLoPagadoError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
