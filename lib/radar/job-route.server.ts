import "server-only";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";

/** Presupuesto de una corrida: Vercel corta a los 300 s. */
export const RADAR_JOB_BUDGET_MS = 230_000;

export function isAuthorizedJobRequest(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

/**
 * Autoriza y respeta la bandera RADAR_JOBS_ENABLED. Con ?force=1 corre aunque
 * la bandera esté apagada (para probar a mano con el secreto del cron).
 */
export function guardRadarJob(request: Request): { response: NextResponse | null; force: boolean } {
  if (!isAuthorizedJobRequest(request)) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }), force: false };
  }
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!serverEnv.radarJobsEnabled && !force) {
    return {
      response: NextResponse.json({ ok: true, skipped: "RADAR_JOBS_ENABLED está apagado." }),
      force,
    };
  }
  return { response: null, force };
}

export function radarJobError(error: unknown, label: string): NextResponse {
  const message = error instanceof Error ? error.message : `Error en ${label}`;
  console.warn(`[radar] ${label}_failed`, { message });
  return NextResponse.json({ error: message }, { status: 500 });
}
