import { NextResponse } from "next/server";
import { resolveLinkedRpStore } from "@/lib/realprofit/connect-guard.server";
import { callRealProfitApi } from "@/lib/realprofit/install-link.server";

export const runtime = "nodejs";

/**
 * Meta en modo socio: el cliente compartió su cuenta publicitaria con nuestro
 * Business; Real Profit la valida, la vincula y jala 30 días de gasto.
 * POST { adAccountId, storeId? }
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    adAccountId?: string;
    storeId?: string;
  };
  const ctx = await resolveLinkedRpStore(body.storeId);
  if (!ctx.ok) return ctx.response;

  const res = await callRealProfitApi<{ message?: string; accountName?: string }>(
    "/api/ads/meta/partner",
    ctx.hecomClienteId,
    { storeId: ctx.storeId, adAccountId: body.adAccountId ?? "" },
  );
  return NextResponse.json(
    res.ok ? { ok: true, ...res.data } : { error: res.data.error ?? "No se pudo conectar Meta." },
    { status: res.ok ? 200 : res.status },
  );
}
