import { NextResponse } from "next/server";
import { forwardPixelEvents } from "@/lib/pixels/pixel-tokens.server";

export const runtime = "nodejs";

// Misma forma que https://business-api.tiktok.com/open_api/v1.3/event/track/ para que un
// programador solo cambie el dominio. Pública: la autoriza el access token del píxel.
const MAX_BODY_BYTES = 1_000_000;

export async function POST(request: Request) {
  const token = (request.headers.get("access-token") ?? "").trim();
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ code: 40002, message: "Pedido muy grande.", data: {} }, { status: 413 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ code: 40002, message: "JSON inválido.", data: {} }, { status: 400 });
  }
  const result = await forwardPixelEvents(token, payload);
  return NextResponse.json(result.body, { status: result.status });
}
