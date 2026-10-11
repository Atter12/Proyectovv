import "server-only";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import {
  parseTrendingList,
  parseVideoList,
  VIDEO_LIST_MAX_HASHTAGS,
  type DiscoveredVideo,
  type TrendingHashtag,
} from "@/lib/radar/discovery-parse";

/**
 * Discovery API de TikTok (Organic API). Requiere el permiso
 * "Creative Management › Discovery" en la app.
 * https://business-api.tiktok.com/portal/docs/discovery-api-overview/v1.3
 */

export type DiscoveryDateRange = "1DAY" | "7DAY" | "30DAY" | "120DAY";

/** Top 200 hashtags de una categoría en un país. */
export async function fetchTrendingHashtags(input: {
  accessToken: string;
  advertiserId: string;
  countryCode: string;
  categoryName: string;
  dateRange: DiscoveryDateRange;
}): Promise<TrendingHashtag[]> {
  const data = await tiktokRequest<unknown>({
    path: "/discovery/trending_list/",
    accessToken: input.accessToken,
    query: {
      advertiser_id: input.advertiserId,
      discovery_type: "HASHTAG",
      country_code: input.countryCode,
      category_name: input.categoryName,
      date_range: input.dateRange,
    },
  });
  return parseTrendingList(data);
}

/**
 * Top 20 videos de cada hashtag (máx. 10 hashtags). El país debe estar en el
 * top_country_list de cada hashtag (ver pickHashtagsForVideoList).
 */
export async function fetchVideosForHashtags(input: {
  accessToken: string;
  advertiserId: string;
  hashtagIds: string[];
  countryCode: string;
  dateRange: DiscoveryDateRange;
}): Promise<DiscoveredVideo[]> {
  const hashtagIds = [...new Set(input.hashtagIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    VIDEO_LIST_MAX_HASHTAGS,
  );
  if (hashtagIds.length === 0) return [];
  const data = await tiktokRequest<unknown>({
    path: "/discovery/video_list/",
    accessToken: input.accessToken,
    query: {
      advertiser_id: input.advertiserId,
      discovery_type: "HASHTAG",
      hashtag_ids: hashtagIds,
      country_code: input.countryCode,
      date_range: input.dateRange,
    },
  });
  return parseVideoList(data);
}
