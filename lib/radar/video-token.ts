import { createHmac, timingSafeEqual } from "node:crypto";
import type { VideoTags } from "./tags";

/**
 * El Radar no guarda videos: cada ronda se busca en vivo. Para que el
 * servidor confíe en lo que el navegador le devuelve (qué video marcó y con
 * qué etiquetas) sin haberlo guardado, cada video viaja firmado con HMAC.
 * Solo datos públicos del video; caduca a las 24 h.
 */

export type VideoTokenPayload = {
  videoId: string;
  shareUrl: string;
  caption: string;
  tags: VideoTags;
  hashtags: string[];
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signVideoToken(payload: VideoTokenPayload, secret: string, now = Date.now()): string {
  const body = b64url(
    JSON.stringify({
      v: payload.videoId,
      u: payload.shareUrl,
      c: payload.caption.slice(0, 400),
      t: payload.tags,
      h: payload.hashtags.slice(0, 5),
      at: now,
    }),
  );
  return `${body}.${sign(body, secret)}`;
}

/** null si la firma no cuadra, está mal formado o caducó. */
export function verifyVideoToken(token: unknown, secret: string, now = Date.now()): VideoTokenPayload | null {
  if (typeof token !== "string" || token.length > 4000) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof raw.at !== "number" || now - raw.at > MAX_AGE_MS) return null;
    const videoId = String(raw.v ?? "");
    if (!/^\d{5,30}$/.test(videoId)) return null;
    return {
      videoId,
      shareUrl: String(raw.u ?? ""),
      caption: String(raw.c ?? ""),
      // Ya venían normalizadas al firmar y la firma garantiza que no cambiaron.
      tags: (raw.t && typeof raw.t === "object" && !Array.isArray(raw.t) ? raw.t : {}) as VideoTags,
      hashtags: Array.isArray(raw.h) ? raw.h.map(String).slice(0, 5) : [],
    };
  } catch {
    return null;
  }
}
