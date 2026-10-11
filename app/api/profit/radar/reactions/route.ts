import { NextResponse } from "next/server";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { saveRoundReactions } from "@/lib/radar/round-builder.server";
import type { Reaction } from "@/lib/radar/taste";

export const runtime = "nodejs";

const REACTIONS: Reaction[] = ["like", "dislike", "pick"];

/** Guarda lo que el cliente marcó en una ronda y recalcula su gusto. */
export async function POST(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    round?: unknown;
    reactions?: Array<{ videoId?: unknown; reaction?: unknown }>;
  };
  const round = body.round === 2 ? 2 : body.round === 1 ? 1 : null;
  if (!round) return NextResponse.json({ error: "Ronda inválida." }, { status: 400 });

  const reactions = (Array.isArray(body.reactions) ? body.reactions : [])
    .slice(0, 40)
    .map((r) => ({ videoId: String(r?.videoId ?? "").trim(), reaction: r?.reaction as Reaction }))
    .filter((r) => r.videoId && REACTIONS.includes(r.reaction));

  if (round === 2 && !reactions.some((r) => r.reaction === "pick")) {
    return NextResponse.json({ error: "Elige al menos un video que te guste." }, { status: 400 });
  }

  try {
    const profile = await saveRoundReactions({ hecomClienteId: ctx.clienteId, round, reactions });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return radarApiError(error, "No se pudieron guardar tus elecciones.");
  }
}
