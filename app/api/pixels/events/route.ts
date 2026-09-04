import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { setupCodEventsForStoredPixel } from "@/lib/pixels/tiktok-pixels.server";
import { TikTokPixelApiError } from "@/lib/integrations/tiktok/pixel.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requirePermission("adAccounts:create");
  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  let body: { pixelRowId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const pixelRowId =
    typeof body.pixelRowId === "string" ? body.pixelRowId.trim() : "";
  if (!pixelRowId) {
    return NextResponse.json(
      { error: "pixelRowId requerido." },
      { status: 400 },
    );
  }

  try {
    const result = await setupCodEventsForStoredPixel({
      organizationId: session.organizationId,
      hecomClienteId: selected.id,
      pixelRowId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron crear eventos.";
    const status = error instanceof TikTokPixelApiError ? 502 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
