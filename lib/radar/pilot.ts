/**
 * Piloto (Fase 5): propuestas sobre los anuncios del cliente a partir de sus
 * métricas diarias (sin dependencias, para tests).
 *
 * Reglas que no se negocian:
 * - Solo propone; el cliente confirma. La única acción ejecutable es pausar
 *   un anuncio (baja el gasto y se puede revertir). Subir presupuesto es una
 *   recomendación: el Copiloto no compromete saldo.
 * - Nada en fase de aprendizaje: pocos días o poco gasto no dan veredicto.
 * - Cambios de presupuesto de 50% como máximo (guía de TikTok).
 */

export type PilotDayRow = {
  advertiserId: string;
  adId: string;
  adgroupId: string | null;
  campaignId: string | null;
  adName: string | null;
  statDate: string;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  results: number | null;
};

export type PilotAdRef = { advertiserId: string; adId: string; adName: string; adgroupId: string | null };

export type PilotProposal =
  | {
      id: string;
      kind: "pause_loser_same_group";
      loser: PilotAdRef;
      winner: PilotAdRef;
      loserCostPerResult: number | null;
      winnerCostPerResult: number;
      averageCostPerResult: number;
    }
  | {
      id: string;
      kind: "pause_loser";
      loser: PilotAdRef;
      loserCostPerResult: number | null;
      loserSpend: number;
      averageCostPerResult: number;
    }
  | {
      id: string;
      kind: "scale_winner";
      winner: PilotAdRef;
      winnerCostPerResult: number;
      averageCostPerResult: number;
      /** % más barato que el promedio del cliente. */
      cheaperPct: number;
      maxIncreasePct: number;
    }
  | {
      id: string;
      kind: "refresh_fatigued";
      ad: PilotAdRef;
      ctrDropPct: number;
    }
  | { id: string; kind: "all_losing"; losers: number };

export const PILOT_RULES = {
  /** Días con gasto antes de opinar sobre un anuncio. */
  minDaysActive: 4,
  /** Gasto mínimo del anuncio en la ventana para opinar. */
  minSpend: 15,
  /** Ganador: resultados mínimos y qué tan por debajo del promedio. */
  winnerMinResults: 5,
  winnerMaxRatio: 0.8,
  /** Perdedor: costo por resultado sobre el promedio, o sin resultados tras gastar N veces el promedio. */
  loserMinRatio: 1.6,
  loserNoResultsSpendMultiple: 3,
  /** Solo se proponen pausas sobre anuncios con gasto en los últimos N días de la ventana. */
  recentDays: 2,
  /** Cansancio: CTR reciente vs. sus primeros días. */
  fatigueMinDays: 10,
  fatigueCtrDrop: 0.3,
  maxBudgetIncreasePct: 50,
  maxProposals: 4,
} as const;

type AdStats = PilotAdRef & {
  campaignId: string | null;
  spend: number;
  results: number;
  days: string[];
  lastDate: string;
  byDate: Map<string, { spend: number; impressions: number; clicks: number }>;
};

function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function addDays(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function cpr(ad: { spend: number; results: number }): number | null {
  return ad.results > 0 ? ad.spend / ad.results : null;
}

function ctrBetween(ad: AdStats, from: string, to: string): number | null {
  let imp = 0;
  let clicks = 0;
  for (const [date, v] of ad.byDate) {
    if (date < from || date > to) continue;
    imp += v.impressions;
    clicks += v.clicks;
  }
  return imp > 0 ? clicks / imp : null;
}

function ref(ad: AdStats): PilotAdRef {
  return { advertiserId: ad.advertiserId, adId: ad.adId, adName: ad.adName, adgroupId: ad.adgroupId };
}

export function buildPilotProposals(
  rows: PilotDayRow[],
  options: { dismissedIds?: ReadonlySet<string> } = {},
): { proposals: PilotProposal[]; averageCostPerResult: number | null; dataThrough: string | null } {
  const R = PILOT_RULES;
  const ads = new Map<string, AdStats>();
  let dataThrough: string | null = null;

  for (const row of rows) {
    if (!row.adId) continue;
    const key = `${row.advertiserId}:${row.adId}`;
    const ad =
      ads.get(key) ??
      ({
        advertiserId: row.advertiserId,
        adId: row.adId,
        adName: row.adName || row.adId,
        adgroupId: row.adgroupId,
        campaignId: row.campaignId,
        spend: 0,
        results: 0,
        days: [],
        lastDate: row.statDate,
        byDate: new Map(),
      } as AdStats);
    ad.spend += row.spend || 0;
    ad.results += row.results ?? 0;
    if ((row.spend || 0) > 0 && !ad.days.includes(row.statDate)) ad.days.push(row.statDate);
    const day = ad.byDate.get(row.statDate) ?? { spend: 0, impressions: 0, clicks: 0 };
    day.spend += row.spend || 0;
    day.impressions += row.impressions ?? 0;
    day.clicks += row.clicks ?? 0;
    ad.byDate.set(row.statDate, day);
    if (row.statDate >= ad.lastDate) {
      ad.lastDate = row.statDate;
      if (row.adName) ad.adName = row.adName;
      if (row.adgroupId) ad.adgroupId = row.adgroupId;
    }
    ads.set(key, ad);
    if (!dataThrough || row.statDate > dataThrough) dataThrough = row.statDate;
  }

  const all = [...ads.values()];
  const totalSpend = all.reduce((s, a) => s + a.spend, 0);
  const totalResults = all.reduce((s, a) => s + a.results, 0);
  const avg = totalResults > 0 ? totalSpend / totalResults : null;
  if (!dataThrough || avg == null) return { proposals: [], averageCostPerResult: avg, dataThrough };

  const recentFrom = addDays(dataThrough, -(R.recentDays - 1));
  const isRecent = (ad: AdStats) => ad.days.some((d) => d >= recentFrom);
  // Fuera de aprendizaje: suficientes días y gasto para opinar.
  const mature = all.filter((a) => a.days.length >= R.minDaysActive && a.spend >= R.minSpend);

  const winners = mature
    .filter((a) => a.results >= R.winnerMinResults && isRecent(a))
    .filter((a) => (cpr(a) ?? Infinity) <= avg * R.winnerMaxRatio)
    .sort((a, b) => (cpr(a) ?? 0) - (cpr(b) ?? 0));

  const losers = mature
    .filter(isRecent)
    .filter((a) => {
      const c = cpr(a);
      if (c == null) return a.spend >= avg * R.loserNoResultsSpendMultiple;
      return c >= avg * R.loserMinRatio;
    })
    .sort((a, b) => b.spend - a.spend);

  const proposals: PilotProposal[] = [];
  const used = new Set<string>();

  // 1) Perdedor y ganador en el mismo grupo: pausar el perdedor basta para que
  //    el presupuesto del grupo se vaya al ganador.
  for (const loser of losers) {
    const winner = winners.find(
      (w) => w.adgroupId && w.adgroupId === loser.adgroupId && w.advertiserId === loser.advertiserId,
    );
    if (!winner) continue;
    proposals.push({
      id: `pause_loser_same_group:${loser.advertiserId}:${loser.adId}`,
      kind: "pause_loser_same_group",
      loser: ref(loser),
      winner: ref(winner),
      loserCostPerResult: cpr(loser) != null ? round(cpr(loser)!) : null,
      winnerCostPerResult: round(cpr(winner)!),
      averageCostPerResult: round(avg),
    });
    used.add(loser.adId);
    used.add(winner.adId);
  }

  // 2) Perdedores sin ganador en su grupo.
  for (const loser of losers) {
    if (used.has(loser.adId)) continue;
    proposals.push({
      id: `pause_loser:${loser.advertiserId}:${loser.adId}`,
      kind: "pause_loser",
      loser: ref(loser),
      loserCostPerResult: cpr(loser) != null ? round(cpr(loser)!) : null,
      loserSpend: round(loser.spend),
      averageCostPerResult: round(avg),
    });
    used.add(loser.adId);
  }

  // 3) Ganadores: recomendar subir el presupuesto de su grupo (sin ejecutar).
  for (const winner of winners) {
    if (used.has(winner.adId)) continue;
    proposals.push({
      id: `scale_winner:${winner.advertiserId}:${winner.adId}`,
      kind: "scale_winner",
      winner: ref(winner),
      winnerCostPerResult: round(cpr(winner)!),
      averageCostPerResult: round(avg),
      cheaperPct: Math.round((1 - cpr(winner)! / avg) * 100),
      maxIncreasePct: R.maxBudgetIncreasePct,
    });
    used.add(winner.adId);
  }

  // 4) Anuncios cansados: el CTR reciente cayó frente a sus primeros días.
  for (const ad of mature) {
    if (used.has(ad.adId) || ad.days.length < R.fatigueMinDays || !isRecent(ad)) continue;
    const firstDay = [...ad.days].sort()[0]!;
    const early = ctrBetween(ad, firstDay, addDays(firstDay, 4));
    const late = ctrBetween(ad, addDays(dataThrough, -2), dataThrough);
    if (early == null || late == null || early <= 0) continue;
    const drop = 1 - late / early;
    if (drop < R.fatigueCtrDrop) continue;
    proposals.push({
      id: `refresh_fatigued:${ad.advertiserId}:${ad.adId}`,
      kind: "refresh_fatigued",
      ad: ref(ad),
      ctrDropPct: Math.round(drop * 100),
    });
    used.add(ad.adId);
  }

  // 5) Todo pierde: no mover plata entre perdedores, cambiar de creativo.
  if (winners.length === 0 && losers.length >= 2) {
    proposals.push({ id: "all_losing", kind: "all_losing", losers: losers.length });
  }

  const dismissed = options.dismissedIds ?? new Set<string>();
  return {
    proposals: proposals.filter((p) => !dismissed.has(p.id)).slice(0, R.maxProposals),
    averageCostPerResult: round(avg),
    dataThrough,
  };
}
