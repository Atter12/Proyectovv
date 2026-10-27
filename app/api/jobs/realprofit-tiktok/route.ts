import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { syncHolisticTikTokToRealProfit } from "@/lib/realprofit/sync-tiktok-to-rp.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const expected = serverEnv.cronSecret || serverEnv.internalJobSecret;
  return Boolean(expected && token === expected);
}

/** Gasto TikTok Holistic → rp_ad_spend_daily (Real Profit COD). ?days=N (máx 60). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const daysParam = Number(new URL(request.url).searchParams.get("days"));
  const result = await syncHolisticTikTokToRealProfit({
    days: Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined,
  });
  if (result.errors.length) console.error("[jobs/realprofit-tiktok]", result.errors);
  return NextResponse.json({ ok: true, ...result });
}
