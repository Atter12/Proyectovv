import "server-only";
import { classifyOembed, type OembedResult } from "@/lib/radar/oembed-parse";

/**
 * oEmbed oficial de TikTok, siempre desde el servidor (así no lo bloquea la CSP
 * del navegador). Sirve para saber si un video sigue vivo y para obtener su
 * texto, autor y miniatura sin descargarlo.
 */
export async function fetchTikTokOembed(shareUrl: string): Promise<OembedResult> {
  const url = `https://www.tiktok.com/oembed?url=${encodeURIComponent(shareUrl)}`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => null);
    return classifyOembed(response.status, body);
  } catch (error) {
    return {
      kind: "unknown",
      reason: error instanceof Error ? error.name : "network",
    };
  }
}
