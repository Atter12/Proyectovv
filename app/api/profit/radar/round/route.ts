import { NextResponse } from "next/server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { getRadarProfile } from "@/lib/radar/profiles.server";
import { buildRound } from "@/lib/radar/round-builder.server";

export const runtime = "nodejs";
// Búsqueda en vivo: Google + oEmbed + etiquetas de la IA en cada ronda.
export const maxDuration = 60;

/**
 * Videos de la ronda 1 (amplia) o 2 (reducida), con reservas, buscados en el
 * momento. `exclude` = IDs ya vistos en esta sesión (nada se guarda).
 */
export async function GET(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const params = new URL(request.url).searchParams;
  const n = params.get("n") === "2" ? 2 : 1;
  const exclude = new Set(
    (params.get("exclude") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d{5,30}$/.test(id))
      .slice(0, 60),
  );
  try {
    const profile = await getRadarProfile(ctx.clienteId);
    if (!profile?.categoryName) {
      return NextResponse.json({ error: "Primero elige tu rubro." }, { status: 400 });
    }
    const round = await buildRound({ profile, round: n, exclude, deadlineMs: Date.now() + 50_000 });
    return NextResponse.json({ ok: true, ...round });
  } catch (error) {
    return radarApiError(error, "No se pudieron cargar los videos.");
  }
}
