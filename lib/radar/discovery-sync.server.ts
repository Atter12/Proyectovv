import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import {
  fetchTrendingHashtags,
  fetchVideosForHashtags,
  type DiscoveryDateRange,
} from "@/lib/integrations/tiktok/discovery.server";
import { TikTokApiError, TikTokRateLimitError } from "@/lib/integrations/tiktok/http.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientAdvertisers } from "@/lib/radar/advertisers.server";
import {
  authorHandleFromShareUrl,
  pickHashtagsForVideoList,
  type DiscoveredVideo,
} from "@/lib/radar/discovery-parse";
import { chunk, loadJobRun, saveJobRun } from "@/lib/radar/job-runs.server";

/**
 * Proceso diario: por cada categoría activa × país, hashtags en tendencia
 * (/discovery/trending_list/) y sus videos top (/discovery/video_list/) →
 * radar_hashtags, radar_videos y radar_video_sources. Los videos no se
 * descargan: solo se guarda el enlace.
 */

export type DiscoverySyncResult = {
  runDate: string;
  status: "complete" | "partial" | "skipped";
  pairsTotal: number;
  pairsDone: number;
  hashtagsSaved: number;
  videosSeen: number;
  pairs: Array<{ category: string; country: string; hashtags: number; videos: number; note?: string }>;
  stoppedByRateLimit: boolean;
  error?: string;
};

async function activeCategories(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_client_profiles")
    .select("category_name")
    .not("category_name", "is", null);
  if (error) throw new Error(`radar_client_profiles: ${error.message}`);
  const fromProfiles = (data ?? []).map((r) => String(r.category_name ?? "").trim().toUpperCase());
  return [...new Set([...serverEnv.radarDefaultCategories, ...fromProfiles].filter(Boolean))];
}

async function resolveDiscoveryAdvertiserId(): Promise<string> {
  if (serverEnv.radarDiscoveryAdvertiserId) return serverEnv.radarDiscoveryAdvertiserId;
  const { byAdvertiser } = await loadClientAdvertisers();
  const first = [...byAdvertiser.keys()].sort()[0];
  if (!first) throw new Error("No hay cuentas TikTok de clientes para usar en Discovery. Configura RADAR_DISCOVERY_ADVERTISER_ID.");
  return first;
}

async function saveVideos(input: {
  category: string;
  country: string;
  runDate: string;
  videos: DiscoveredVideo[];
}): Promise<void> {
  if (input.videos.length === 0) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Un mismo video puede salir en varios hashtags de la misma consulta.
  const uniqueVideos = new Map<string, DiscoveredVideo>();
  for (const v of input.videos) if (!uniqueVideos.has(v.videoId)) uniqueVideos.set(v.videoId, v);

  for (const part of chunk([...uniqueVideos.values()], 500)) {
    const { error } = await admin.from("radar_videos").upsert(
      part.map((v) => ({
        video_id: v.videoId,
        share_url: v.shareUrl,
        embed_url: v.embedUrl,
        author_handle: authorHandleFromShareUrl(v.shareUrl),
        last_seen_at: now,
      })),
      { onConflict: "video_id" },
    );
    if (error) throw new Error(`radar_videos: ${error.message}`);
  }

  const sources = new Map<string, Record<string, unknown>>();
  for (const v of input.videos) {
    const key = `${v.videoId}|${v.hashtagId}`;
    if (sources.has(key)) continue;
    sources.set(key, {
      video_id: v.videoId,
      category_name: input.category,
      country_code: input.country,
      hashtag_id: v.hashtagId,
      hashtag_name: v.hashtagName,
      discovery_rank: v.rank,
      last_seen_date: input.runDate,
    });
  }
  for (const part of chunk([...sources.values()], 500)) {
    const { error } = await admin
      .from("radar_video_sources")
      .upsert(part, { onConflict: "video_id,category_name,country_code,hashtag_id" });
    if (error) throw new Error(`radar_video_sources: ${error.message}`);
  }
}

export async function runDiscoverySync(input: {
  runDate: string;
  deadlineMs: number;
  force?: boolean;
}): Promise<DiscoverySyncResult> {
  const previous = await loadJobRun("discovery", input.runDate);
  if (previous?.status === "complete" && !input.force) {
    return {
      runDate: input.runDate,
      status: "skipped",
      pairsTotal: Number(previous.stats.pairsTotal ?? 0),
      pairsDone: Number(previous.stats.pairsDone ?? 0),
      hashtagsSaved: 0,
      videosSeen: 0,
      pairs: [],
      stoppedByRateLimit: false,
    };
  }

  const categories = await activeCategories();
  const countries = serverEnv.radarCountryCodes;
  const dateRange = serverEnv.radarDiscoveryDateRange as DiscoveryDateRange;
  const allPairs = categories.flatMap((category) => countries.map((country) => `${category}|${country}`));
  const done = new Set(input.force ? [] : (previous?.cursor.done ?? []));

  const { token } = await resolveTikTokFinanceAccessToken();
  const advertiserId = await resolveDiscoveryAdvertiserId();
  const admin = createAdminClient();

  const pairs: DiscoverySyncResult["pairs"] = [];
  let hashtagsSaved = 0;
  let videosSeen = 0;
  let stoppedByRateLimit = false;
  let fatalError: string | undefined;

  for (const pair of allPairs) {
    if (done.has(pair)) continue;
    if (Date.now() >= input.deadlineMs) break;
    const [category, country] = pair.split("|") as [string, string];

    try {
      const hashtags = await fetchTrendingHashtags({
        accessToken: token,
        advertiserId,
        countryCode: country,
        categoryName: category,
        dateRange,
      });

      if (hashtags.length > 0) {
        for (const part of chunk(hashtags, 500)) {
          const { error } = await admin.from("radar_hashtags").upsert(
            part.map((h) => ({
              hashtag_id: h.hashtagId,
              country_code: country,
              category_name: category,
              date_range: dateRange,
              snapshot_date: input.runDate,
              hashtag_name: h.hashtagName,
              rank_position: h.rankPosition,
              rank_change: h.rankChange,
              views: h.views,
              posts: h.posts,
              top_countries: h.topCountries,
            })),
            { onConflict: "hashtag_id,country_code,category_name,date_range,snapshot_date" },
          );
          if (error) throw new Error(`radar_hashtags: ${error.message}`);
        }
        hashtagsSaved += hashtags.length;
      }

      const picked = pickHashtagsForVideoList(hashtags, country, serverEnv.radarHashtagsPerCategory);
      const videos =
        picked.length > 0
          ? await fetchVideosForHashtags({
              accessToken: token,
              advertiserId,
              hashtagIds: picked.map((h) => h.hashtagId),
              countryCode: country,
              dateRange,
            })
          : [];
      await saveVideos({ category, country, runDate: input.runDate, videos });
      videosSeen += videos.length;

      pairs.push({
        category,
        country,
        hashtags: hashtags.length,
        videos: videos.length,
        ...(picked.length === 0 && hashtags.length > 0 ? { note: "ningún hashtag tiene este país en su top" } : {}),
      });
      done.add(pair);
    } catch (error) {
      if (error instanceof TikTokRateLimitError) {
        stoppedByRateLimit = true;
        break;
      }
      if (!(error instanceof TikTokApiError)) {
        // Fallo de la base u otro inesperado: guardar avance y propagar.
        await saveJobRun("discovery", input.runDate, {
          status: "failed",
          cursor: { done: [...done] },
          stats: { error: error instanceof Error ? error.message : "error" },
        }).catch(() => undefined);
        throw error;
      }
      if (/permission|scope|authori/i.test(error.message)) {
        // Sin el permiso Discovery no tiene sentido seguir con los demás pares.
        fatalError = `Falta el permiso Discovery en la app de TikTok: ${error.message}`;
        break;
      }
      pairs.push({
        category,
        country,
        hashtags: 0,
        videos: 0,
        note: error instanceof Error ? error.message : "error",
      });
      done.add(pair);
    }
  }

  const status = allPairs.every((p) => done.has(p)) ? "complete" : "partial";
  const stats = {
    pairsTotal: allPairs.length,
    pairsDone: done.size,
    hashtagsSavedLastRun: hashtagsSaved,
    videosSeenLastRun: videosSeen,
    stoppedByRateLimit,
    ...(fatalError ? { error: fatalError } : {}),
  };
  await saveJobRun("discovery", input.runDate, {
    status: fatalError ? "failed" : status,
    cursor: { done: [...done] },
    stats,
  });
  console.info("[radar] discovery_run", { runDate: input.runDate, status, ...stats });

  return {
    runDate: input.runDate,
    status,
    pairsTotal: allPairs.length,
    pairsDone: done.size,
    hashtagsSaved,
    videosSeen,
    pairs,
    stoppedByRateLimit,
    ...(fatalError ? { error: fatalError } : {}),
  };
}
