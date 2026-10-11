import { NextResponse } from "next/server";
import { runLivenessCheck } from "@/lib/radar/liveness.server";
import { guardRadarJob, RADAR_JOB_BUDGET_MS, radarJobError } from "@/lib/radar/job-route.server";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(request: Request) {
  const deadlineMs = Date.now() + RADAR_JOB_BUDGET_MS;
  const { response } = guardRadarJob(request);
  if (response) return response;

  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? "400");
  try {
    const result = await runLivenessCheck({
      deadlineMs,
      limit: Number.isFinite(limitRaw) ? limitRaw : 400,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return radarJobError(error, "liveness");
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
