import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { syncPartnerCommissions } from "@/lib/partners/partner-commissions.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

/** Registra las comisiones de aliados por las recargas nuevas de sus clientes. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await syncPartnerCommissions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[jobs/partner-commissions] failed", error);
    return NextResponse.json({ error: "No se pudieron calcular las comisiones." }, { status: 500 });
  }
}
