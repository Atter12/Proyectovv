import { NextResponse } from "next/server";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { runAdDailySync } from "@/lib/radar/ad-daily-sync.server";
import { guardRadarJob, RADAR_JOB_BUDGET_MS, radarJobError } from "@/lib/radar/job-route.server";

export const runtime = "nodejs";
// Una consulta de reporte por anunciante de cliente; con decenas de cuentas no
// cabe en el límite por defecto.
export const maxDuration = 300;

async function run(request: Request) {
  const deadlineMs = Date.now() + RADAR_JOB_BUDGET_MS;
  const { response, force } = guardRadarJob(request);
  if (response) return response;

  const url = new URL(request.url);
  const requested = url.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested)
    ? requested
    : shiftYmd(todayYmdInTz("America/Lima"), -1);
  const onlyAdvertiserIds = (url.searchParams.get("advertiser_ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  try {
    const result = await runAdDailySync({
      date,
      deadlineMs,
      force: force && url.searchParams.get("redo") === "1",
      onlyAdvertiserIds,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return radarJobError(error, "ad_daily");
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
