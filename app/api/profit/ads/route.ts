import { NextResponse } from "next/server";
import { clampProfitDateRange, defaultProfitDateRange } from "@/lib/realprofit/db.server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { loadClienteAdPerformance } from "@/lib/radar/ad-performance.server";

export const runtime = "nodejs";

/** Rendimiento por anuncio del cliente seleccionado (Profit › tabla de anuncios). */
export async function GET(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const url = new URL(request.url);
  const defaults = defaultProfitDateRange();
  const { from, to } = clampProfitDateRange({
    from: url.searchParams.get("from")?.trim() || defaults.from,
    to: url.searchParams.get("to")?.trim() || defaults.to,
  });

  try {
    const summary = await loadClienteAdPerformance({ hecomClienteId: ctx.clienteId, from, to });
    return NextResponse.json({ ok: true, from, to, ...summary });
  } catch (error) {
    return radarApiError(error, "No se pudo cargar el rendimiento por anuncio.");
  }
}
