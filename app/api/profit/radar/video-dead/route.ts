import { NextResponse } from "next/server";
import { radarApiContext } from "@/lib/radar/api-context.server";
import { confirmVideoDead } from "@/lib/radar/round-builder.server";

export const runtime = "nodejs";

/**
 * El reproductor avisó que un video no carga. Se confirma con oEmbed antes de
 * reemplazarlo: el navegador del cliente no decide qué videos se apagan.
 */
export async function POST(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const dead = await confirmVideoDead(body.token).catch(() => false);
  return NextResponse.json({ ok: true, dead });
}
