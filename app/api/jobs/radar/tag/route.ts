import { NextResponse } from "next/server";
import { tagUntaggedVideos } from "@/lib/radar/tag-video.server";
import { guardRadarJob, RADAR_JOB_BUDGET_MS, radarJobError } from "@/lib/radar/job-route.server";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(request: Request) {
  const deadlineMs = Date.now() + RADAR_JOB_BUDGET_MS;
  const { response } = guardRadarJob(request);
  if (response) return response;

  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? "90");
  try {
    const result = await tagUntaggedVideos({
      deadlineMs,
      limit: Number.isFinite(limitRaw) ? limitRaw : 90,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return radarJobError(error, "tag");
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
