import { NextResponse } from "next/server";
import {
  createPublicCardDebtIntent,
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

  let body: { amount?: number; periodoResumen?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const created = await createPublicCardDebtIntent({
      provider: "stripe",
      ctx,
      token,
      amount: Number(body.amount),
      periodoResumen: String(body.periodoResumen ?? ""),
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    const message =
      error instanceof PublicLoPagadoError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo abrir el pago con tarjeta.";
    const status = error instanceof PublicLoPagadoError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
