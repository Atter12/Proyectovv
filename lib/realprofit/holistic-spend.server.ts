import "server-only";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import {
  buildCampaignSpendFromGastos,
  filterCampaignSpendRows,
  mergeSnapshotsWithNewerGastos,
  sumCampaignSpend,
  type HecomCampaignSpendRow,
} from "@/lib/hecom/campaign-spend";
import type { HecomGastoRow } from "@/lib/hecom/cliente-finance.types";
import { shiftYmd } from "@/lib/hecom/gasto-date";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";

export type HolisticDailyPoint = { date: string; spend: number };

export type HolisticCampaignAgg = {
  campaignExternalId: string;
  campaignName: string;
  platform: string;
  spend: number;
  advertiserId: string | null;
  bm: string | null;
};

export type HolisticTikTokSpendBundle = {
  from: string;
  to: string;
  adSpend: number;
  daysWithActivity: number;
  dailySeries: HolisticDailyPoint[];
  rows: HecomCampaignSpendRow[];
  byCampaign: HolisticCampaignAgg[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function dateKey(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function mapGasto(row: Record<string, unknown>): HecomGastoRow {
  const fecha =
    dateKey(row.tiktok_stat_date) ??
    dateKey(row.fecha_movimiento) ??
    dateKey(row.mes) ??
    (row.tiktok_stat_date
      ? String(row.tiktok_stat_date)
      : row.fecha_movimiento
        ? String(row.fecha_movimiento)
        : row.mes
          ? String(row.mes)
          : null);

  return {
    id: String(row.id ?? ""),
    camp: row.camp ? String(row.camp) : null,
    gasto: Number(row.gasto ?? row.monto ?? 0) || 0,
    fee:
      row.fee != null && Number.isFinite(Number(row.fee))
        ? Number(row.fee)
        : null,
    mes: row.mes ? String(row.mes) : null,
    source: row.source ? String(row.source) : null,
    fecha,
    codigo: row.codigo ? String(row.codigo) : null,
    notas: row.notas ? String(row.notas) : null,
  };
}

export function fillDailySeries(
  from: string,
  to: string,
  rows: HecomCampaignSpendRow[],
): HolisticDailyPoint[] {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    byDate.set(row.date, round2((byDate.get(row.date) ?? 0) + row.spend));
  }
  const out: HolisticDailyPoint[] = [];
  if (!from || !to || from > to) return out;
  let d = from;
  while (d <= to) {
    out.push({ date: d, spend: byDate.get(d) ?? 0 });
    d = shiftYmd(d, 1);
    if (out.length > 400) break;
  }
  return out;
}

function aggregateCampaigns(
  inRange: HecomCampaignSpendRow[],
): HolisticCampaignAgg[] {
  const byCampaign = new Map<string, HolisticCampaignAgg>();

  for (const row of inRange) {
    const cid = (row.campaignId ?? "").trim();
    const key = cid
      ? `tiktok:${cid}`
      : `tiktok:name:${row.campaignName}:${row.advertiserId ?? ""}`;
    const prev = byCampaign.get(key);
    if (prev) {
      prev.spend = round2(prev.spend + row.spend);
      if (!prev.bm && row.bm) prev.bm = row.bm;
    } else {
      byCampaign.set(key, {
        campaignExternalId: cid || `name:${row.campaignName}`,
        campaignName: row.campaignName,
        platform: "tiktok",
        spend: row.spend,
        advertiserId: row.advertiserId,
        bm: row.bm,
      });
    }
  }

  return [...byCampaign.values()]
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}

/**
 * Gasto TikTok del cliente Hecom (snapshots + gastos) en un rango.
 * Misma fuente que Gastos / campañas en Holistic.
 */
export async function loadHolisticTikTokSpendForCliente(input: {
  hecomClienteId: string;
  from: string;
  to: string;
}): Promise<HolisticTikTokSpendBundle> {
  const from = input.from.trim();
  const to = input.to.trim();
  const empty: HolisticTikTokSpendBundle = {
    from,
    to,
    adSpend: 0,
    daysWithActivity: 0,
    dailySeries: fillDailySeries(from, to, []),
    rows: [],
    byCampaign: [],
  };

  let overview;
  try {
    overview = await getHecomClienteAdAccountsOverview(
      input.hecomClienteId,
      "fast",
    );
  } catch {
    return empty;
  }

  const bmByAdvertiser = new Map<string, string | null>();
  for (const acc of overview.accounts) {
    const id = (acc.externalAccountId ?? "").trim();
    if (!id) continue;
    const bm =
      (acc.externalBusinessId ?? "").trim() ||
      (acc.bcId ?? "").trim() ||
      null;
    bmByAdvertiser.set(id, bm);
  }

  let fromGastos: HecomCampaignSpendRow[] = [];
  const snapshots: HecomCampaignSpendRow[] = [];

  try {
    const hecom = createHecomAdminClient();
    const { data: gastoData } = await hecom
      .from("gastos")
      .select(
        "id,client_id,mes,camp,gasto,fee,source,fecha_movimiento,tiktok_stat_date,codigo,notas",
      )
      .eq("client_id", input.hecomClienteId)
      .order("created_at", { ascending: false })
      .limit(2500);

    if (gastoData) {
      const mapped = (gastoData as Record<string, unknown>[])
        .filter((row) => String(row.client_id ?? "") === input.hecomClienteId)
        .map(mapGasto);
      fromGastos = buildCampaignSpendFromGastos(mapped, bmByAdvertiser);
    }

    const { data: snapData } = await hecom
      .from("tiktok_spend_snapshots")
      .select(
        "stat_date,spend,campaign_id,campaign_name,advertiser_id,client_id",
      )
      .eq("client_id", input.hecomClienteId)
      .gte("stat_date", from)
      .lte("stat_date", to)
      .order("stat_date", { ascending: false })
      .limit(8000);

    if (snapData?.length) {
      const bmFromGastos = new Map<string, string>();
      for (const g of fromGastos) {
        if (g.advertiserId && g.bm && !bmFromGastos.has(g.advertiserId)) {
          bmFromGastos.set(g.advertiserId, g.bm);
        }
      }
      for (const row of snapData as Array<Record<string, unknown>>) {
        if (String(row.client_id ?? "") !== input.hecomClienteId) continue;
        const date = dateKey(row.stat_date);
        if (!date || date < from || date > to) continue;
        const spend = Number(row.spend ?? 0);
        if (!Number.isFinite(spend) || spend <= 0) continue;
        const advertiserId = row.advertiser_id
          ? String(row.advertiser_id)
          : null;
        snapshots.push({
          date,
          campaignName:
            String(row.campaign_name ?? "").trim() || "Sin nombre",
          campaignId: row.campaign_id ? String(row.campaign_id) : null,
          spend: round2(spend),
          bm:
            (advertiserId ? bmByAdvertiser.get(advertiserId) : null) ??
            (advertiserId ? bmFromGastos.get(advertiserId) ?? null : null),
          advertiserId,
        });
      }
    }
  } catch {
    return empty;
  }

  const merged =
    snapshots.length > 0
      ? mergeSnapshotsWithNewerGastos(
          snapshots,
          filterCampaignSpendRows(fromGastos, { startDate: from, endDate: to }),
        )
      : filterCampaignSpendRows(fromGastos, { startDate: from, endDate: to });

  const inRange = filterCampaignSpendRows(merged, {
    startDate: from,
    endDate: to,
  });

  const dailySeries = fillDailySeries(from, to, inRange);
  const daysWithActivity = dailySeries.filter((p) => p.spend > 0).length;

  return {
    from,
    to,
    adSpend: sumCampaignSpend(inRange),
    daysWithActivity,
    dailySeries,
    rows: inRange,
    byCampaign: aggregateCampaigns(inRange),
  };
}

/** Slice KPIs from a wider holistic load without re-querying. */
export function sliceHolisticSpend(
  wide: HolisticTikTokSpendBundle,
  from: string,
  to: string,
): HolisticTikTokSpendBundle {
  const inRange = filterCampaignSpendRows(wide.rows, {
    startDate: from,
    endDate: to,
  });
  const dailySeries = fillDailySeries(from, to, inRange);
  return {
    from,
    to,
    adSpend: sumCampaignSpend(inRange),
    daysWithActivity: dailySeries.filter((p) => p.spend > 0).length,
    dailySeries,
    rows: inRange,
    byCampaign: aggregateCampaigns(inRange),
  };
}
