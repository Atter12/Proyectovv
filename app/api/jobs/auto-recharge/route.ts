import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { runDueCalendarAutoRecharges } from "@/lib/payments/auto-recharge/auto-recharge.server";

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
    const result = await runDueCalendarAutoRecharges();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error en auto-recharge job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
