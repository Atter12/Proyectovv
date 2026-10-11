import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { callOpenAiJson } from "@/lib/radar/openai.server";
import { fetchTikTokOembed } from "@/lib/radar/oembed.server";
import { chunk, forEachUntil } from "@/lib/radar/job-runs.server";
import { normalizeTags, TAG_DIMENSIONS } from "@/lib/radar/tags";

/**
 * Etiquetado v1 de la biblioteca: la IA deduce las etiquetas a partir del
 * texto del video, sus hashtags y su autor (oEmbed). No ve la imagen: el
 * análisis visual queda en pausa hasta confirmarlo con TikTok. Solo se
 * guardan las dimensiones que el texto permite deducir con confianza.
 */

export const TAG_PROMPT_VERSION = "radar-tag-text-v1";
const BATCH_SIZE = 15;

type Candidate = {
  video_id: string;
  share_url: string;
  caption: string | null;
  author_name: string | null;
  author_handle: string | null;
};

const SYSTEM = `Clasificas videos de TikTok para una plataforma de anuncios en Perú.
Solo recibes el texto del video, sus hashtags y el autor; no ves la imagen.
Para cada video devuelve SOLO las dimensiones que el texto permita deducir con
confianza razonable; omite las demás. Valores permitidos (usa exactamente estas claves):
${Object.entries(TAG_DIMENSIONS)
  .map(([dimension, values]) => `- ${dimension}: ${values.join(" | ")}`)
  .join("\n")}
Responde JSON: {"videos":[{"id":"<id>","tags":{"<dimension>":"<valor>"}}]}`;

export type TagRunResult = { tagged: number; dead: number; failedBatches: number; pending: number };

export async function tagUntaggedVideos(input: { deadlineMs: number; limit?: number }): Promise<TagRunResult> {
  const admin = createAdminClient();
  const limit = Math.max(1, Math.min(input.limit ?? 90, 300));
  const { data, error } = await admin
    .from("radar_videos")
    .select("video_id, share_url, caption, author_name, author_handle")
    .eq("status", "alive")
    .is("tags_source", null)
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`radar_videos: ${error.message}`);

  const candidates = (data ?? []) as Candidate[];
  const result: TagRunResult = { tagged: 0, dead: 0, failedBatches: 0, pending: 0 };

  // Completar el texto con oEmbed donde falte (y descartar los que ya murieron).
  const alive: Candidate[] = [];
  await forEachUntil(candidates, 4, input.deadlineMs, async (video) => {
    if (video.caption) {
      alive.push(video);
      return;
    }
    const oembed = await fetchTikTokOembed(video.share_url);
    if (oembed.kind === "dead") {
      result.dead += 1;
      await admin
        .from("radar_videos")
        .update({ status: "dead", dead_reason: oembed.reason, last_checked_at: new Date().toISOString() })
        .eq("video_id", video.video_id);
      return;
    }
    if (oembed.kind === "alive") {
      video.caption = oembed.title;
      video.author_name = oembed.authorName;
      await admin
        .from("radar_videos")
        .update({ caption: oembed.title, author_name: oembed.authorName, last_checked_at: new Date().toISOString() })
        .eq("video_id", video.video_id);
    }
    alive.push(video);
  });

  const hashtagsByVideo = new Map<string, string[]>();
  if (alive.length > 0) {
    const { data: sources } = await admin
      .from("radar_video_sources")
      .select("video_id, hashtag_name")
      .in("video_id", alive.map((v) => v.video_id));
    for (const row of (sources ?? []) as Array<{ video_id: string; hashtag_name: string }>) {
      const list = hashtagsByVideo.get(row.video_id) ?? [];
      if (!list.includes(row.hashtag_name)) list.push(row.hashtag_name);
      hashtagsByVideo.set(row.video_id, list);
    }
  }

  const batches = chunk(alive, BATCH_SIZE);
  for (const [index, batch] of batches.entries()) {
    if (Date.now() >= input.deadlineMs) {
      result.pending = batches.slice(index).reduce((n, b) => n + b.length, 0);
      break;
    }
    const payload = batch.map((v) => ({
      id: v.video_id,
      texto: (v.caption ?? "").slice(0, 400),
      hashtags: hashtagsByVideo.get(v.video_id) ?? [],
      autor: v.author_name ?? v.author_handle ?? null,
    }));
    try {
      const { json } = await callOpenAiJson({ system: SYSTEM, user: JSON.stringify({ videos: payload }) });
      const byId = new Map<string, unknown>();
      for (const item of Array.isArray(json.videos) ? json.videos : []) {
        const record = item as Record<string, unknown>;
        if (typeof record?.id === "string") byId.set(record.id, record.tags);
      }
      for (const video of batch) {
        // Sin texto ni respuesta queda {} igual, para no reintentarlo cada día.
        const tags = normalizeTags(byId.get(video.video_id));
        const { error: updateError } = await admin
          .from("radar_videos")
          .update({ tags, tags_source: "text", tags_version: TAG_PROMPT_VERSION })
          .eq("video_id", video.video_id);
        if (!updateError) result.tagged += 1;
      }
    } catch (error) {
      result.failedBatches += 1;
      console.warn("[radar] tag_batch_failed", {
        message: error instanceof Error ? error.message : "error",
        size: batch.length,
      });
    }
  }

  console.info("[radar] tag_run", result);
  return result;
}
