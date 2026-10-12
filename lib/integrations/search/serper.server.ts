import "server-only";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Búsqueda en Google vía Serper (https://serper.dev). La usa el Radar para
 * encontrar videos públicos de TikTok mientras Discovery no está disponible.
 */

export type SerperResult = { title: string; link: string; snippet: string; position: number };

export class SerperError extends Error {}

export function isSerperConfigured(): boolean {
  return Boolean(serverEnv.serperApiKey);
}

export async function searchSerper(input: {
  query: string;
  /** País de los resultados en minúscula (pe, mx, co). */
  gl: string;
  num?: number;
  /** Página de resultados (1 = primera). */
  page?: number;
}): Promise<SerperResult[]> {
  if (!serverEnv.serperApiKey) throw new SerperError("SERPER_API_KEY no configurada.");
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    cache: "no-store",
    headers: { "X-API-KEY": serverEnv.serperApiKey, "Content-Type": "application/json" },
    // Más de 10 resultados por consulta da 400 en el plan gratis.
    body: JSON.stringify({
      q: input.query,
      gl: input.gl,
      hl: "es",
      num: Math.min(10, input.num ?? 10),
      ...(input.page && input.page > 1 ? { page: input.page } : {}),
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : `HTTP ${response.status}`;
    throw new SerperError(`Serper: ${message}`);
  }
  // Resultados normales y, si Google los trae, el carrusel de videos.
  const rows = [
    ...((body?.organic as unknown[]) ?? []),
    ...((body?.videos as unknown[]) ?? []),
  ] as Array<Record<string, unknown>>;
  return rows.map((row, i) => ({
    title: String(row.title ?? ""),
    link: String(row.link ?? ""),
    snippet: String(row.snippet ?? ""),
    position: Number(row.position ?? i + 1),
  }));
}
