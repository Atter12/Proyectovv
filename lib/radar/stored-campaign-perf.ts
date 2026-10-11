/**
 * Rendimiento por campaña armado desde radar_ad_daily, para que Profit no
 * consulte TikTok en cada visita (sin dependencias, para tests).
 *
 * Solo se usa si los procesos diarios cubren todos los días del rango; si
 * falta uno, Profit sigue consultando en vivo como antes.
 */

/** Misma forma que TikTokCampaignPerfRow (campaign-performance.server.ts). */
export type StoredCampaignPerfRow = {
  advertiserId: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  costPerConversion: number | null;
};

export type CampaignAdDayRow = {
  advertiserId: string;
  campaignId: string | null;
  campaignName: string | null;
  statDate: string;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function campaignPerfFromAdDays(rows: CampaignAdDayRow[]): StoredCampaignPerfRow[] {
  type Acc = { row: StoredCampaignPerfRow; lastDate: string; convKnown: boolean };
  const byCampaign = new Map<string, Acc>();
  for (const r of rows) {
    const campaignId = String(r.campaignId ?? "").trim();
    if (!campaignId) continue;
    const key = `${r.advertiserId}:${campaignId}`;
    const acc =
      byCampaign.get(key) ??
      ({
        row: {
          advertiserId: r.advertiserId,
          campaignId,
          campaignName: r.campaignName || campaignId,
          spend: 0,
          impressions: 0,
          clicks: 0,
          ctr: null,
          cpc: null,
          cpm: null,
          conversions: null,
          costPerConversion: null,
        },
        lastDate: r.statDate,
        convKnown: false,
      } as Acc);
    acc.row.spend += r.spend || 0;
    acc.row.impressions += r.impressions ?? 0;
    acc.row.clicks += r.clicks ?? 0;
    if (r.conversions != null) {
      acc.row.conversions = (acc.row.conversions ?? 0) + r.conversions;
      acc.convKnown = true;
    }
    if (r.statDate >= acc.lastDate && r.campaignName) {
      acc.lastDate = r.statDate;
      acc.row.campaignName = r.campaignName;
    }
    byCampaign.set(key, acc);
  }

  return [...byCampaign.values()]
    .map(({ row }) => {
      const spend = round2(row.spend);
      return {
        ...row,
        spend,
        ctr: row.impressions > 0 ? round2((row.clicks / row.impressions) * 100) : null,
        cpc: row.clicks > 0 ? round2(spend / row.clicks) : null,
        cpm: row.impressions > 0 ? round2((spend / row.impressions) * 1000) : null,
        conversions: row.conversions,
        costPerConversion: row.conversions && row.conversions > 0 ? round2(spend / row.conversions) : null,
      };
    })
    .filter((r) => r.spend > 0 || r.impressions > 0 || r.clicks > 0)
    .sort((a, b) => b.spend - a.spend);
}

function shiftYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Días cubiertos por corridas completas de ad-daily: cada corrida con fecha D
 * re-sincroniza D-(resyncDays-1)…D.
 */
export function coveredDays(completedRunDates: string[], resyncDays = 3): Set<string> {
  const out = new Set<string>();
  for (const runDate of completedRunDates) {
    for (let i = 0; i < resyncDays; i += 1) out.add(shiftYmd(runDate, -i));
  }
  return out;
}

export function rangeIsCovered(from: string, to: string, covered: Set<string>): boolean {
  if (!from || !to || from > to) return false;
  for (let day = from; day <= to; day = shiftYmd(day, 1)) {
    if (!covered.has(day)) return false;
  }
  return true;
}
