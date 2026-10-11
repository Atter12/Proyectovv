import { NextResponse } from "next/server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { getRadarProfile } from "@/lib/radar/profiles.server";
import { buildRound } from "@/lib/radar/round-builder.server";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Videos de la ronda 1 (amplia) o 2 (reducida), con reservas. */
export async function GET(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const n = new URL(request.url).searchParams.get("n") === "2" ? 2 : 1;
  try {
    const profile = await getRadarProfile(ctx.clienteId);
    if (!profile?.categoryName) {
      return NextResponse.json({ error: "Primero elige tu rubro." }, { status: 400 });
    }
    const round = await buildRound({ profile, round: n });
    return NextResponse.json({ ok: true, ...round });
  } catch (error) {
    return radarApiError(error, "No se pudieron cargar los videos.");
  }
}
