import { NextResponse } from "next/server";
import { listAlliances } from "@/features/alliances/lib/alliances.server";
import { serverEnv } from "@/lib/env/env.server";

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("x-job-secret") ?? "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const loaded = await listAlliances();
  if (!loaded.ok) {
    return NextResponse.json({ error: "No se pudieron revisar las alianzas." }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    alertsReady: loaded.data.alertsReady,
    expiring: loaded.data.followup.expiring,
    overdueFollowUps: loaded.data.followup.overdueFollowUps,
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
