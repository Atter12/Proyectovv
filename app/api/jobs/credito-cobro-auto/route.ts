import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { runCreditAutocharge } from "@/lib/payments/credit-card/credit-card.server";

/**
 * Cobro automático del crédito Holistic (anti-vivos). Todos los días a las
 * 9:00 de Lima: cobra los lunes (o al llegar al tope del cupo), reintenta
 * los rechazos y congela a quien no pagó en 48 h.
 * CREDIT_AUTOCHARGE_MODE: off (default) | dry_run | live.
 */
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await runCreditAutocharge();
    console.info("[credito-cobro-auto] run", {
      mode: result.mode,
      items: result.items.map((i) => ({
        org: i.organizationId,
        debtCents: i.debtCents,
        action: i.action,
        reason: i.reason,
        error: i.error ?? null,
      })),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en el cobro automático";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
