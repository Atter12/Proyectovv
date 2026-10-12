import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { getRadarProfile } from "@/lib/radar/profiles.server";
import { buildRound, ROUND_SIZE } from "@/lib/radar/round-builder.server";
import { discoverFromWeb } from "@/lib/radar/web-discovery.server";
import { tagUntaggedVideos } from "@/lib/radar/tag-video.server";

export const runtime = "nodejs";
// Si faltan videos se busca en la web en el momento (búsqueda + oEmbed + etiquetas).
export const maxDuration = 60;

/** Búsquedas por ronda cuando no alcanzan los videos (cada una cuesta 1 crédito de Serper). */
const ON_DEMAND_QUERIES = 6;

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
    let round = await buildRound({ profile, round: n });

    // Biblioteca corta para este rubro: buscar ahora con los productos del
    // cliente en vez de pedirle que vuelva mañana.
    if (round.videos.length < ROUND_SIZE[n] && serverEnv.serperApiKey) {
      const started = Date.now();
      const web = await discoverFromWeb({
        category: profile.categoryName,
        products: profile.products,
        countries: serverEnv.radarCountryCodes.slice(0, 1),
        maxQueries: ON_DEMAND_QUERIES,
        deadlineMs: started + 30_000,
      });
      if (web.saved > 0) {
        await tagUntaggedVideos({ deadlineMs: started + 45_000, limit: 60 }).catch((error) => {
          console.warn("[radar] on_demand_tag_failed", { message: error instanceof Error ? error.message : "error" });
        });
        round = await buildRound({ profile, round: n });
      }
      console.info("[radar] on_demand_web", { category: profile.categoryName, ...web, ms: Date.now() - started });
    }

    return NextResponse.json({ ok: true, ...round });
  } catch (error) {
    return radarApiError(error, "No se pudieron cargar los videos.");
  }
}
