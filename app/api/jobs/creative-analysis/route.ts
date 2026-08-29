import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { processQueuedCreativeJobs } from "@/lib/creatives/process-jobs.server";

export const runtime = "nodejs";
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const headerSecret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("x-job-secret") ??
    "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && (token === expected || headerSecret === expected));
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId")?.trim() || undefined;
    const limitRaw = Number(url.searchParams.get("limit") ?? "5");
    const result = await processQueuedCreativeJobs({
      jobId,
      limit: Number.isFinite(limitRaw) ? limitRaw : 5,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error en creative-analysis job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
