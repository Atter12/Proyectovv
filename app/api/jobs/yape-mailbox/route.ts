import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { pollYapeMailbox } from "@/lib/payments/yape/poll-mailbox.server";

// IMAP necesita TCP: no puede correr en el runtime edge.
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

/**
 * Lee la casilla del banco y acredita las recargas cuyo cobro haya llegado.
 *
 * Reemplaza al agente de escritorio: en produccion nadie deberia depender de
 * que una PC quede encendida para que los clientes reciban su saldo.
 */
async function run(request: Request) {
  // Vercel firma sus crons con CRON_SECRET; el mismo secreto sirve para
  // dispararlo a mano durante una prueba.
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await pollYapeMailbox();
    if (!result.enabled) {
      return NextResponse.json({
        ok: true,
        enabled: false,
        reason: "Faltan YAPE_MAIL_USER / YAPE_MAIL_PASSWORD.",
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error leyendo la casilla.";
    console.error("[yape-mailbox] fallo la corrida", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
