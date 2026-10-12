import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { searchSerper, SerperError } from "@/lib/integrations/search/serper.server";
import { callOpenAiJson } from "@/lib/radar/openai.server";
import { fetchTikTokOembed } from "@/lib/radar/oembed.server";
import { chunk, forEachUntil } from "@/lib/radar/job-runs.server";
import { normalizeTags, TAG_DIMENSIONS, type VideoTags } from "@/lib/radar/tags";
import { buildWebQueries, parseTikTokVideoUrl, webSourceLabel } from "@/lib/radar/web-search-parse";
import { signVideoToken, verifyVideoToken, type VideoTokenPayload } from "@/lib/radar/video-token";
import type { RadarCategory } from "@/lib/radar/categories";

/**
 * Biblioteca en vivo del Radar. Nada se guarda: en cada ronda se buscan
 * videos públicos de TikTok (Google vía Serper) con los productos y el rubro
 * del cliente, TikTok confirma cada uno por oEmbed, la IA los etiqueta en
 * memoria y se muestran con el reproductor oficial. Ni el video ni su enlace
 * pasan por la base de datos.
 */

export type LiveVideo = {
  videoId: string;
  shareUrl: string;
  authorName: string | null;
  authorHandle: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  tags: VideoTags;
  hashtags: string[];
  countryCode: string | null;
  bestRank: number;
  /** Firma del servidor para que el navegador pueda devolverlo sin guardarlo. */
  token: string;
};

export const TAG_PROMPT_VERSION = "radar-tag-text-v1";
const TAG_BATCH_SIZE = 15;
/** Candidatos que se comprueban y etiquetan por ronda (tiempo y costo acotados). */
const MAX_CANDIDATES = 40;

const TAG_SYSTEM = `Clasificas videos de TikTok para una plataforma de anuncios en Perú.
Solo recibes el texto del video, sus hashtags y el autor; no ves la imagen.
Para cada video devuelve SOLO las dimensiones que el texto permita deducir con
confianza razonable; omite las demás. Valores permitidos (usa exactamente estas claves):
${Object.entries(TAG_DIMENSIONS)
  .map(([dimension, values]) => `- ${dimension}: ${values.join(" | ")}`)
  .join("\n")}
Responde JSON: {"videos":[{"id":"<id>","tags":{"<dimension>":"<valor>"}}]}`;

function tokenSecret(): string {
  const secret = serverEnv.internalJobSecret || serverEnv.cronSecret;
  if (!secret) throw new Error("Falta INTERNAL_JOB_SECRET o CRON_SECRET para firmar los videos del Radar.");
  return secret;
}

export function signLiveVideo(video: Omit<LiveVideo, "token">): string {
  return signVideoToken(
    {
      videoId: video.videoId,
      shareUrl: video.shareUrl,
      caption: video.caption ?? "",
      tags: video.tags,
      hashtags: video.hashtags,
    },
    tokenSecret(),
  );
}

/** Lo que el navegador devuelve de un video, verificado; null si no es nuestro. */
export function readVideoToken(token: unknown): VideoTokenPayload | null {
  const payload = verifyVideoToken(token, tokenSecret());
  return payload ? { ...payload, tags: normalizeTags(payload.tags) } : null;
}

/** Etiquetas de la IA a partir del texto, en memoria. Si falla, quedan vacías. */
async function tagInMemory(
  videos: Array<{ videoId: string; caption: string | null; author: string | null; hashtags: string[] }>,
  deadlineMs: number,
): Promise<Map<string, VideoTags>> {
  const out = new Map<string, VideoTags>();
  await Promise.all(
    chunk(videos, TAG_BATCH_SIZE).map(async (batch) => {
      if (Date.now() >= deadlineMs) return;
      try {
        const { json } = await callOpenAiJson({
          system: TAG_SYSTEM,
          user: JSON.stringify({
            videos: batch.map((v) => ({
              id: v.videoId,
              texto: (v.caption ?? "").slice(0, 400),
              hashtags: v.hashtags,
              autor: v.author,
            })),
          }),
          timeoutMs: Math.max(5_000, deadlineMs - Date.now()),
        });
        for (const item of Array.isArray(json.videos) ? json.videos : []) {
          const record = item as Record<string, unknown>;
          if (typeof record?.id === "string") out.set(record.id, normalizeTags(record.tags));
        }
      } catch (error) {
        console.warn("[radar] live_tag_failed", {
          message: error instanceof Error ? error.message : "error",
          size: batch.length,
        });
      }
    }),
  );
  return out;
}

export type LivePoolResult = { videos: LiveVideo[]; queries: number; found: number; error?: string };

export async function buildLivePool(input: {
  category: RadarCategory;
  products: string[];
  /** Página de resultados de Google: la ronda 2 usa la 2 para traer videos nuevos. */
  page?: number;
  maxQueries: number;
  /** IDs que no deben volver (ya vistos en esta sesión). */
  exclude?: ReadonlySet<string>;
  deadlineMs: number;
}): Promise<LivePoolResult> {
  const country = serverEnv.radarCountryCodes[0] ?? "PE";
  const queries = buildWebQueries({ category: input.category, products: input.products, maxQueries: input.maxQueries });
  if (!serverEnv.serperApiKey) return { videos: [], queries: 0, found: 0, error: "SERPER_API_KEY no configurada." };

  // 1) Buscar en paralelo. Un video puede salir en varias consultas: se queda la mejor posición.
  const candidates = new Map<string, { ref: NonNullable<ReturnType<typeof parseTikTokVideoUrl>>; query: string; rank: number; title: string }>();
  let error: string | undefined;
  let done = 0;
  await Promise.all(
    queries.map(async (query) => {
      try {
        const rows = await searchSerper({ query, gl: country.toLowerCase(), page: input.page });
        done += 1;
        for (const row of rows) {
          const ref = parseTikTokVideoUrl(row.link);
          if (!ref || input.exclude?.has(ref.videoId)) continue;
          const existing = candidates.get(ref.videoId);
          if (!existing || row.position < existing.rank) {
            candidates.set(ref.videoId, { ref, query, rank: row.position, title: row.title });
          }
        }
      } catch (e) {
        if (e instanceof SerperError) error = e.message;
        else throw e;
      }
    }),
  );
  const found = candidates.size;
  const ordered = [...candidates.values()].sort((a, b) => a.rank - b.rank).slice(0, MAX_CANDIDATES);

  // 2) oEmbed: fuera lo que TikTok da por borrado. Si TikTok frena (503) el
  //    enlace igual es real —viene de Google, no de la IA—: se muestra con el
  //    título de la búsqueda y, si no carga, el navegador lo reemplaza.
  const checked: Array<Omit<LiveVideo, "tags" | "token">> = [];
  await forEachUntil(ordered, 6, input.deadlineMs - 12_000, async (c) => {
    const oembed = await fetchTikTokOembed(c.ref.shareUrl);
    if (oembed.kind === "dead") return;
    const alive = oembed.kind === "alive" ? oembed : null;
    checked.push({
      videoId: c.ref.videoId,
      shareUrl: c.ref.shareUrl,
      authorName: alive?.authorName ?? null,
      authorHandle: c.ref.handle,
      caption: alive?.title ?? (c.title || null),
      thumbnailUrl: alive?.thumbnailUrl ?? null,
      hashtags: [webSourceLabel(c.query)],
      countryCode: country,
      bestRank: c.rank,
    });
  });

  // 3) Etiquetas en memoria y firma.
  const tags = await tagInMemory(
    checked.map((v) => ({ videoId: v.videoId, caption: v.caption, author: v.authorName ?? v.authorHandle, hashtags: v.hashtags })),
    input.deadlineMs,
  );
  const videos = checked.map((v) => {
    const withTags = { ...v, tags: tags.get(v.videoId) ?? {} };
    return { ...withTags, token: signLiveVideo(withTags) };
  });
  return { videos, queries: done, found, error };
}
