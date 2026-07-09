import type { AdminMetricAccent } from "./AdminMetricCard";

/**
 * Royalty-free background textures (Unsplash / Pexels CDN).
 * Each accent has a primary URL plus fallbacks if the CDN asset is unavailable.
 */
export const KPI_CARD_BACKGROUNDS: Record<AdminMetricAccent, readonly string[]> = {
  indigo: [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=560&h=320&fit=crop&q=80&auto=format",
    "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg?auto=compress&cs=tinysrgb&w=560&h=320&fit=crop",
  ],
  emerald: [
    "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=560&h=320&fit=crop&q=80&auto=format",
    "https://images.pexels.com/photos/6770615/pexels-photo-6770615.jpeg?auto=compress&cs=tinysrgb&w=560&h=320&fit=crop",
  ],
  amber: [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=560&h=320&fit=crop&q=80&auto=format",
    "https://images.pexels.com/photos/6863332/pexels-photo-6863332.jpeg?auto=compress&cs=tinysrgb&w=560&h=320&fit=crop",
  ],
  rose: [
    "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=560&h=320&fit=crop&q=80&auto=format",
    "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&w=560&h=320&fit=crop",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=560&h=320&fit=crop&q=80&auto=format",
  ],
};
