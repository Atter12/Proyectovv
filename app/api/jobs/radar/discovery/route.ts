import { NextResponse } from "next/server";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";
import { runDiscoverySync } from "@/lib/radar/discovery-sync.server";
import { guardRadarJob, RADAR_JOB_BUDGET_MS, radarJobError } from "@/lib/radar/job-route.server";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(request: Request) {
  const deadlineMs = Date.now() + RADAR_JOB_BUDGET_MS;
  const { response, force } = guardRadarJob(request);
  if (response) return response;

  const url = new URL(request.url);
  try {
    const result = await runDiscoverySync({
      runDate: todayYmdInTz("America/Lima"),
      deadlineMs,
      force: force && url.searchParams.get("redo") === "1",
    });
    return NextResponse.json({ ok: !result.error, ...result }, { status: result.error ? 502 : 200 });
  } catch (error) {
    return radarJobError(error, "discovery");
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
