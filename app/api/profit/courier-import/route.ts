import { NextResponse } from "next/server";
import { resolveLinkedRpStore } from "@/lib/realprofit/connect-guard.server";
import { callRealProfitApi } from "@/lib/realprofit/install-link.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * CSV del courier → estados y cobrado en Real Profit.
 * POST { csv, apply?, storeId? } — apply=false devuelve la vista previa.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    csv?: string;
    apply?: boolean;
    storeId?: string;
  };
  const ctx = await resolveLinkedRpStore(body.storeId);
  if (!ctx.ok) return ctx.response;

  const res = await callRealProfitApi<Record<string, unknown>>(
    "/api/orders/import",
    ctx.hecomClienteId,
    { storeId: ctx.storeId, csv: body.csv ?? "", apply: Boolean(body.apply) },
  );
  return NextResponse.json(
    res.ok ? res.data : { ...res.data, error: res.data.error ?? "No se pudo leer el archivo." },
    { status: res.ok ? 200 : res.status },
  );
}
