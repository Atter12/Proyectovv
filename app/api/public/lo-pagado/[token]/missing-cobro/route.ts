import { NextResponse } from "next/server";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import {
  createPublicMissingCobro,
  PublicLoPagadoError,
  resolvePublicLoPagado,
} from "@/lib/payments/public-lo-pagado.server";
import { listMissingCobroClaimsForCliente } from "@/services/payments.service";

export const runtime = "nodejs";

function publicClaims(
  claims: Awaited<ReturnType<typeof listMissingCobroClaimsForCliente>>,
) {
  return claims.map((claim) => ({
    ...claim,
    actorEmail: null,
    actorName: null,
    proofSignedUrl: null,
    organizationName: null,
    failureReason: claim.reviewStatus === "rejected" ? claim.failureReason : null,
  }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ctx = await resolvePublicLoPagado(token);
  if (!ctx) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }
  const claims = await listMissingCobroClaimsForCliente(ctx.clientId);
  return NextResponse.json({
    ok: true,
    claims: publicClaims(claims),
    periodos: listRecentPeriodos(6),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ctx = await resolvePublicLoPagado(token);
  if (!ctx) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }

  let body: {
    amountUsd?: number;
    periodoResumen?: string;
    paymentFecha?: string;
    metodo?: string;
    operationCode?: string;
    notes?: string;
    amountPen?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const created = await createPublicMissingCobro({
      ctx,
      amountUsd: Number(body.amountUsd),
      periodoResumen: String(body.periodoResumen ?? ""),
      paymentFecha: String(body.paymentFecha ?? ""),
      metodo: body.metodo,
      operationCode: body.operationCode,
      notes: body.notes,
      amountPen:
        typeof body.amountPen === "number" && Number.isFinite(body.amountPen)
          ? body.amountPen
          : null,
    });
    return NextResponse.json({
      ok: true,
      paymentIntentId: created.paymentIntentId,
    });
  } catch (error) {
    const message =
      error instanceof PublicLoPagadoError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo crear el reporte.";
    const status = error instanceof PublicLoPagadoError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
