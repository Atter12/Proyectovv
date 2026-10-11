import { NextResponse } from "next/server";
import { radarApiContext } from "@/lib/radar/api-context.server";
import { confirmVideoDead } from "@/lib/radar/round-builder.server";

export const runtime = "nodejs";

/**
 * El reproductor avisó que un video no carga. Se confirma con oEmbed antes de
 * marcarlo: el navegador del cliente no decide qué videos se apagan.
 */
export async function POST(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { videoId?: unknown };
  const videoId = String(body.videoId ?? "").trim();
  if (!/^\d{5,30}$/.test(videoId)) return NextResponse.json({ error: "Video inválido." }, { status: 400 });

  const dead = await confirmVideoDead(videoId).catch(() => false);
  return NextResponse.json({ ok: true, dead });
}
