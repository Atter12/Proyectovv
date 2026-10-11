import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTikTokOembed } from "@/lib/radar/oembed.server";
import { forEachUntil } from "@/lib/radar/job-runs.server";

/**
 * Proceso nocturno: revisa con oEmbed los videos vivos que no se revisan hace
 * días. Los borrados, privados o sin inserción quedan "dead" y el Radar deja
 * de mostrarlos. De paso guarda el texto y el autor (sirven para etiquetar).
 */

const RECHECK_AFTER_DAYS = 3;
const CONCURRENCY = 4;

export type LivenessResult = {
  checked: number;
  alive: number;
  dead: number;
  unknown: number;
  pendingInBatch: number;
};

export async function runLivenessCheck(input: {
  deadlineMs: number;
  limit?: number;
}): Promise<LivenessResult> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RECHECK_AFTER_DAYS * 86_400_000).toISOString();
  const limit = Math.max(1, Math.min(input.limit ?? 400, 1000));

  const { data, error } = await admin
    .from("radar_videos")
    .select("video_id, share_url")
    .eq("status", "alive")
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`radar_videos: ${error.message}`);

  const videos = (data ?? []) as Array<{ video_id: string; share_url: string }>;
  const result: LivenessResult = { checked: 0, alive: 0, dead: 0, unknown: 0, pendingInBatch: 0 };

  const left = await forEachUntil(videos, CONCURRENCY, input.deadlineMs, async (video) => {
    const oembed = await fetchTikTokOembed(video.share_url);
    result.checked += 1;
    const now = new Date().toISOString();

    if (oembed.kind === "alive") {
      result.alive += 1;
      const update: Record<string, unknown> = { last_checked_at: now };
      if (oembed.title) update.caption = oembed.title;
      if (oembed.authorName) update.author_name = oembed.authorName;
      await admin.from("radar_videos").update(update).eq("video_id", video.video_id);
      return;
    }
    if (oembed.kind === "dead") {
      result.dead += 1;
      await admin
        .from("radar_videos")
        .update({ status: "dead", dead_reason: oembed.reason, last_checked_at: now })
        .eq("video_id", video.video_id);
      return;
    }
    // Fallo temporal: no se toca, se revisa en la próxima corrida.
    result.unknown += 1;
  });

  result.pendingInBatch = left.length;
  console.info("[radar] liveness_run", result);
  return result;
}
