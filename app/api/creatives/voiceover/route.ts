import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { synthesizeVoiceover, VOICEOVER_MAX_CHARS } from "@/lib/creatives/voiceover.server";

export const runtime = "nodejs";

/** Voz en off de una frase para "Crear video" (por ahora solo el equipo). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (!hasPermission(session.permissions, "creativeAnalyzer:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }
  const funding = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return NextResponse.json({ error: "Solo para el equipo." }, { status: 403 });
  }

  let body: { text?: unknown; voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = body.voice === "male" ? "male" : body.voice === "female" ? "female" : null;
  if (!text || text.length > VOICEOVER_MAX_CHARS || !voice) {
    return NextResponse.json({ error: "Texto o voz inválidos." }, { status: 400 });
  }

  try {
    const audio = await synthesizeVoiceover({ text, voice });
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.warn("[creatives] voiceover", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No se pudo generar la voz." }, { status: 502 });
  }
}
