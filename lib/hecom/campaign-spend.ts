import {
  getAdvertiserIdFromCamp,
  getBmFromHecomCamp,
  getCampaignNameFromHecomNotas,
} from "@/lib/hecom/gasto-label";
import type { HecomGastoRow } from "@/lib/hecom/cliente-finance.types";

/** One spend row per campaign × day (from snapshots or gastos). */
export type HecomCampaignSpendRow = {
  date: string;
  campaignName: string;
  campaignId: string | null;
  spend: number;
  bm: string | null;
  advertiserId: string | null;
};

export type CampaignSpendSummary = {
  campaignName: string;
  total: number;
  bm: string | null;
  /** Último día con gasto (YYYY-MM-DD). */
  lastDate: string | null;
};

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

function dateKeyFromGasto(row: HecomGastoRow): string | null {
  const raw = row.fecha ?? row.mes;
  if (!raw?.trim()) return null;
  const iso = raw.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const m = raw.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function buildCampaignSpendFromGastos(
  gastos: HecomGastoRow[],
  bmByAdvertiser: Map<string, string | null>,
): HecomCampaignSpendRow[] {
  const rows: HecomCampaignSpendRow[] = [];

  for (const row of gastos) {
    const spend = Number(row.gasto);
    if (!Number.isFinite(spend) || spend <= 0) continue;

    const date = dateKeyFromGasto(row);
    if (!date) continue;

    const advertiserId = getAdvertiserIdFromCamp(row.camp);
    const campaignName =
      getCampaignNameFromHecomNotas(row.notas) ??
      getBmFromHecomCamp(row.camp) ??
      "Gasto ads";
    const bm =
      (advertiserId ? bmByAdvertiser.get(advertiserId) : null) ??
      getBmFromHecomCamp(row.camp);

    rows.push({
      date,
      campaignName,
      campaignId: null,
      spend: roundUsd(spend),
      bm,
      advertiserId,
    });
  }

  return rows;
}

export function listUniqueBms(rows: HecomCampaignSpendRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.bm?.trim()) set.add(row.bm.trim());
  }
  return [...set].sort((a, b) => {
    const na = Number(a.replace(/\D/g, ""));
    const nb = Number(b.replace(/\D/g, ""));
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

export function filterCampaignSpendRows(
  rows: HecomCampaignSpendRow[],
  opts: {
    bm?: string | null;
    /** Advertiser IDs that belong to the selected BM (fallback if row.bm is null). */
    advertiserIdsForBm?: Set<string> | null;
    campaignName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): HecomCampaignSpendRow[] {
  const bm = opts.bm?.trim() || null;
  const advertisers = opts.advertiserIdsForBm;
  const campaign = opts.campaignName?.trim() || null;
  const start = opts.startDate?.trim() || null;
  const end = opts.endDate?.trim() || null;

  return rows.filter((row) => {
    if (bm) {
      const bmMatch = row.bm === bm;
      const advertiserMatch =
        Boolean(advertisers?.size) &&
        Boolean(row.advertiserId) &&
        advertisers!.has(row.advertiserId!);
      if (!bmMatch && !advertiserMatch) return false;
    }
    if (campaign && row.campaignName !== campaign) return false;
    if (start && row.date < start) return false;
    if (end && row.date > end) return false;
    return true;
  });
}

export function sumCampaignSpend(rows: HecomCampaignSpendRow[]): number {
  return roundUsd(rows.reduce((acc, row) => acc + row.spend, 0));
}

export function listCampaignsBySpend(
  rows: HecomCampaignSpendRow[],
): CampaignSpendSummary[] {
  const byName = new Map<
    string,
    { total: number; bm: string | null; lastDate: string | null }
  >();

  for (const row of rows) {
    const existing = byName.get(row.campaignName);
    if (existing) {
      existing.total = roundUsd(existing.total + row.spend);
      if (!existing.bm && row.bm) existing.bm = row.bm;
      if (!existing.lastDate || row.date > existing.lastDate) {
        existing.lastDate = row.date;
      }
    } else {
      byName.set(row.campaignName, {
        total: row.spend,
        bm: row.bm,
        lastDate: row.date,
      });
    }
  }

  return [...byName.entries()]
    .map(([campaignName, meta]) => ({
      campaignName,
      total: meta.total,
      bm: meta.bm,
      lastDate: meta.lastDate,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Campañas con gasto más reciente primero. */
export function listCampaignsByRecent(
  rows: HecomCampaignSpendRow[],
): CampaignSpendSummary[] {
  return listCampaignsBySpend(rows).sort((a, b) => {
    const da = a.lastDate ?? "";
    const db = b.lastDate ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.total - a.total;
  });
}

export function mergeBmLabels(
  fromRows: string[],
  fromAccounts: Array<string | null | undefined>,
): string[] {
  const set = new Set<string>(fromRows);
  for (const raw of fromAccounts) {
    const label = String(raw ?? "").trim();
    if (label) set.add(label);
  }
  return [...set].sort((a, b) => {
    const na = Number(a.replace(/\D/g, ""));
    const nb = Number(b.replace(/\D/g, ""));
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

export function buildDailySeriesFromCampaignRows(
  rows: HecomCampaignSpendRow[],
): Array<{ date: string; spend: number }> {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    byDate.set(row.date, roundUsd((byDate.get(row.date) ?? 0) + row.spend));
  }
  return [...byDate.entries()]
    .map(([date, spend]) => ({ date, spend }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getCampaignSpendDateBounds(rows: HecomCampaignSpendRow[]): {
  min: string | null;
  max: string | null;
} {
  if (rows.length === 0) return { min: null, max: null };
  const dates = rows.map((r) => r.date).sort();
  return { min: dates[0] ?? null, max: dates.at(-1) ?? null };
}

/**
 * Une snapshots (prioridad) con filas de gastos más nuevas,
 * para no quedar trabados en la última fecha de sync vieja.
 */
export function mergeSnapshotsWithNewerGastos(
  snapshots: HecomCampaignSpendRow[],
  fromGastos: HecomCampaignSpendRow[],
): HecomCampaignSpendRow[] {
  if (snapshots.length === 0) return fromGastos;
  if (fromGastos.length === 0) return snapshots;

  let maxSnap = snapshots[0]?.date ?? "";
  for (const row of snapshots) {
    if (row.date > maxSnap) maxSnap = row.date;
  }

  const newer = fromGastos.filter((row) => row.date > maxSnap);
  if (newer.length === 0) return snapshots;
  return [...snapshots, ...newer];
}
