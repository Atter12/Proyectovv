import { NextResponse } from "next/server";
import { isAuthorizedJobRequest, RADAR_JOB_BUDGET_MS } from "@/lib/radar/job-route.server";
import { runLaunchOptimizer } from "@/lib/campaigns/launch-optimizer.server";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sugerencias de las campañas lanzadas, a mano (normalmente corre al final del
 * radar de la madrugada). ?dry=1 devuelve lo que sugeriría sin guardar nada.
 */
async function run(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  try {
    const result = await runLaunchOptimizer({ deadlineMs: Date.now() + RADAR_JOB_BUDGET_MS, dryRun });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "optimizer_failed";
    console.warn("[campaigns] optimize_failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
