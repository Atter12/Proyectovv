import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { createPixelToken } from "@/lib/pixels/pixel-tokens.server";

export const runtime = "nodejs";

/** Genera el access token de Events API del píxel (anula el anterior). */
export async function POST(request: Request) {
  const session = await requirePermission("adAccounts:create");
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 });
  }

  let body: { pixelRowId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const pixelRowId = typeof body.pixelRowId === "string" ? body.pixelRowId.trim() : "";
  if (!pixelRowId) {
    return NextResponse.json({ error: "pixelRowId requerido." }, { status: 400 });
  }

  try {
    const result = await createPixelToken({
      hecomClienteId: selected.id,
      pixelRowId,
      userId: session.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el token.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
