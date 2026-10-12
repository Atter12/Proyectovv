import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSerperConfigured, searchSerper, SerperError } from "@/lib/integrations/search/serper.server";
import { fetchTikTokOembed } from "@/lib/radar/oembed.server";
import { chunk, forEachUntil } from "@/lib/radar/job-runs.server";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";
import type { RadarCategory } from "@/lib/radar/categories";
import {
  buildWebQueries,
  parseTikTokVideoUrl,
  webSourceId,
  webSourceLabel,
  type WebVideoRef,
} from "@/lib/radar/web-search-parse";

/**
 * Segunda fuente del Radar: busca en Google videos públicos de TikTok con los
 * productos del cliente y su rubro, comprueba cada uno con oEmbed y los guarda
 * en radar_videos / radar_video_sources igual que Discovery. Solo entra un
 * video si TikTok confirma que existe; los enlaces no se inventan ni se
 * descargan.
 */

export type WebDiscoveryResult = {
  queries: number;
  found: number;
  saved: number;
  dead: number;
  unverified: number;
  error?: string;
};

type Candidate = WebVideoRef & { query: string; country: string; rank: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function discoverFromWeb(input: {
  category: RadarCategory;
  products: string[];
  /** Países a buscar (PE, MX, CO); cada consulta se repite por país. */
  countries: string[];
  maxQueries: number;
  deadlineMs: number;
}): Promise<WebDiscoveryResult> {
  const result: WebDiscoveryResult = { queries: 0, found: 0, saved: 0, dead: 0, unverified: 0 };
  if (!isSerperConfigured()) return { ...result, error: "SERPER_API_KEY no configurada." };

  const countries = input.countries.length > 0 ? input.countries : serverEnv.radarCountryCodes;
  const perCountry = Math.max(1, Math.floor(input.maxQueries / countries.length));
  const queries = buildWebQueries({ category: input.category, products: input.products, maxQueries: perCountry });

  // 1) Buscar. Un video puede salir en varias consultas: se queda la mejor posición.
  const candidates = new Map<string, Candidate>();
  outer: for (const query of queries) {
    for (const country of countries) {
      if (Date.now() > input.deadlineMs) break outer;
      try {
        const rows = await searchSerper({ query, gl: country.toLowerCase() });
        result.queries += 1;
        for (const row of rows) {
          const ref = parseTikTokVideoUrl(row.link);
          if (!ref) continue;
          const existing = candidates.get(ref.videoId);
          if (!existing || row.position < existing.rank) {
            candidates.set(ref.videoId, { ...ref, query, country, rank: row.position });
          }
        }
      } catch (error) {
        // Sin créditos o clave inválida: no tiene sentido seguir.
        if (error instanceof SerperError) {
          result.error = error.message;
          break outer;
        }
        throw error;
      }
    }
  }
  result.found = candidates.size;
  if (candidates.size === 0) return result;

  // 2) Los que ya conocemos vivos no se vuelven a comprobar.
  const admin = createAdminClient();
  const ids = [...candidates.keys()];
  const known = new Map<string, string>();
  for (const part of chunk(ids, 200)) {
    const { data, error } = await admin.from("radar_videos").select("video_id, status").in("video_id", part);
    if (error) throw new Error(`radar_videos: ${error.message}`);
    for (const row of data ?? []) known.set(String(row.video_id), String(row.status));
  }

  // 3) oEmbed: solo pasa lo que TikTok confirma. TikTok frena con 503 si se le
  //    pregunta muy rápido, así que va de a 3 y se reintenta una vez.
  const now = new Date().toISOString();
  const alive: Array<Candidate & { caption: string | null; authorName: string | null; isNew: boolean }> = [];
  const toCheck = [...candidates.values()].filter((c) => known.get(c.videoId) !== "dead");
  await forEachUntil(toCheck, 3, input.deadlineMs, async (candidate) => {
    if (known.get(candidate.videoId) === "alive") {
      alive.push({ ...candidate, caption: null, authorName: null, isNew: false });
      return;
    }
    let oembed = await fetchTikTokOembed(candidate.shareUrl);
    if (oembed.kind === "unknown") {
      await sleep(1500);
      oembed = await fetchTikTokOembed(candidate.shareUrl);
    }
    if (oembed.kind === "dead") {
      result.dead += 1;
      return;
    }
    if (oembed.kind !== "alive") {
      result.unverified += 1;
      return;
    }
    alive.push({ ...candidate, caption: oembed.title, authorName: oembed.authorName, isNew: true });
  });

  // 4) Guardar como lo hace Discovery.
  const fresh = alive.filter((v) => v.isNew);
  for (const part of chunk(fresh, 200)) {
    const { error } = await admin.from("radar_videos").upsert(
      part.map((v) => ({
        video_id: v.videoId,
        share_url: v.shareUrl,
        author_handle: v.handle,
        author_name: v.authorName,
        caption: v.caption?.slice(0, 2000) ?? null,
        status: "alive",
        last_seen_at: now,
        last_checked_at: now,
      })),
      { onConflict: "video_id" },
    );
    if (error) throw new Error(`radar_videos: ${error.message}`);
  }
  const seenAgain = alive.filter((v) => !v.isNew).map((v) => v.videoId);
  for (const part of chunk(seenAgain, 200)) {
    await admin.from("radar_videos").update({ last_seen_at: now }).in("video_id", part);
  }

  const runDate = todayYmdInTz("America/Lima");
  for (const part of chunk(alive, 200)) {
    const { error } = await admin.from("radar_video_sources").upsert(
      part.map((v) => ({
        video_id: v.videoId,
        category_name: input.category,
        country_code: v.country,
        hashtag_id: webSourceId(v.query),
        hashtag_name: webSourceLabel(v.query),
        discovery_rank: v.rank,
        last_seen_date: runDate,
      })),
      { onConflict: "video_id,category_name,country_code,hashtag_id" },
    );
    if (error) throw new Error(`radar_video_sources: ${error.message}`);
  }
  result.saved = alive.length;
  return result;
}
