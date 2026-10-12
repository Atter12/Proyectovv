import { NextResponse } from "next/server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { getRadarProfile } from "@/lib/radar/profiles.server";
import { saveRoundReactions } from "@/lib/radar/round-builder.server";
import type { Reaction } from "@/lib/radar/taste";

export const runtime = "nodejs";

const REACTIONS: Reaction[] = ["like", "dislike", "pick"];

/**
 * Lo que el cliente marcó en una ronda pasa a su gusto. Cada video llega con
 * la firma del servidor (`token`); no se guarda el video ni la reacción.
 */
export async function POST(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    round?: unknown;
    reactions?: Array<{ token?: unknown; reaction?: unknown }>;
  };
  const round = body.round === 2 ? 2 : body.round === 1 ? 1 : null;
  if (!round) return NextResponse.json({ error: "Ronda inválida." }, { status: 400 });

  const reactions = (Array.isArray(body.reactions) ? body.reactions : [])
    .slice(0, 40)
    .map((r) => ({ token: r?.token, reaction: r?.reaction as Reaction }))
    .filter((r) => typeof r.token === "string" && REACTIONS.includes(r.reaction));

  if (round === 2 && !reactions.some((r) => r.reaction === "pick")) {
    return NextResponse.json({ error: "Elige al menos un video que te guste." }, { status: 400 });
  }

  try {
    const profile = await getRadarProfile(ctx.clienteId);
    if (!profile) return NextResponse.json({ error: "Primero completa tu perfil del Radar." }, { status: 400 });
    const next = await saveRoundReactions({ profile, round, reactions });
    return NextResponse.json({ ok: true, profile: next });
  } catch (error) {
    return radarApiError(error, "No se pudieron guardar tus elecciones.");
  }
}
