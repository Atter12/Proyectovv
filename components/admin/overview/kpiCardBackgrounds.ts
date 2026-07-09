import type { AdminMetricAccent } from "./AdminMetricCard";

/**
 * Royalty-free background textures (Unsplash / Pexels CDN).
 * Each accent has a primary URL plus fallbacks if the CDN asset is unavailable.
 */
const UNSPLASH_BG = (id: string) =>
  `https://images.unsplash.com/${id}?w=960&h=540&fit=crop&q=88&auto=format&dpr=2`;

export const KPI_CARD_BACKGROUNDS: Record<AdminMetricAccent, readonly string[]> = {
  indigo: [
    UNSPLASH_BG("photo-1451187580459-43490279c0fa"),
    "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg?auto=compress&cs=tinysrgb&w=960&h=540&fit=crop&dpr=2",
  ],
  emerald: [
    UNSPLASH_BG("photo-1639762681485-074b7f938ba0"),
    "https://images.pexels.com/photos/6770615/pexels-photo-6770615.jpeg?auto=compress&cs=tinysrgb&w=960&h=540&fit=crop&dpr=2",
  ],
  amber: [
    UNSPLASH_BG("photo-1554224155-6726b3ff858f"),
    "https://images.pexels.com/photos/6863332/pexels-photo-6863332.jpeg?auto=compress&cs=tinysrgb&w=960&h=540&fit=crop&dpr=2",
  ],
  rose: [
    UNSPLASH_BG("photo-1563986768609-322da13575f3"),
    "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&w=960&h=540&fit=crop&dpr=2",
    UNSPLASH_BG("photo-1618005182384-a83a8bd57fbe"),
  ],
};
