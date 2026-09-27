import { NextResponse } from "next/server";
import { signHecomCobroComprobanteUrl } from "@/lib/hecom/cobro-comprobante.server";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { resolvePublicLoPagado } from "@/lib/payments/public-lo-pagado.server";

export const runtime = "nodejs";

function guessComprobanteKind(storagePath: string): "image" | "pdf" | "unknown" {
  const lower = storagePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif|heic|bmp)$/.test(lower)) return "image";
  return "unknown";
}

function parseComprobanteUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // plain path
    }
    return [trimmed];
  }
  return [];
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string; cobroId: string }> },
) {
  const { token, cobroId } = await context.params;
  const ctx = await resolvePublicLoPagado(token);
  if (!ctx) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }

  const index = Number(new URL(request.url).searchParams.get("index") ?? "0");
  if (!cobroId?.trim()) {
    return NextResponse.json({ error: "Cobro inválido." }, { status: 400 });
  }
  if (!Number.isFinite(index) || index < 0 || index > 20) {
    return NextResponse.json({ error: "Índice inválido." }, { status: 400 });
  }

  try {
    const hecom = createHecomAdminClient();
    const { data, error } = await hecom
      .from("cobros")
      .select("id,client_id,comprobante_urls")
      .eq("id", cobroId.trim())
      .maybeSingle<{
        id: string;
        client_id: string;
        comprobante_urls: unknown;
      }>();

    if (error) throw new Error(error.message);
    if (!data?.client_id || data.client_id.toLowerCase() !== ctx.clientId.toLowerCase()) {
      return NextResponse.json({ error: "Cobro no encontrado." }, { status: 404 });
    }

    const urls = parseComprobanteUrls(data.comprobante_urls);
    const storagePath = urls[index];
    if (!storagePath) {
      return NextResponse.json(
        { error: "Este cobro no tiene comprobante adjunto." },
        { status: 404 },
      );
    }

    const url = await signHecomCobroComprobanteUrl(storagePath);
    return NextResponse.json({
      ok: true,
      url,
      kind: guessComprobanteKind(storagePath),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo abrir el comprobante.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
