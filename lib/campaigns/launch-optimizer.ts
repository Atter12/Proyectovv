/**
 * Optimización diaria de las campañas lanzadas desde Ads Holistic (sin
 * dependencias, para tests). Reutiliza las reglas del Piloto del Radar
 * (lib/radar/pilot.ts) dentro de cada campaña y agrega la de presupuesto:
 *
 *   pause_video   el video que pierde dentro de la campaña (Piloto)
 *   new_video     el video que se cansó: hay que cambiarlo (Piloto)
 *   all_losing    todo pierde: cambiar de creativo (Piloto)
 *   raise_budget  la campaña vende más barato que el promedio del cliente,
 *                 salió del aprendizaje y gasta todo su presupuesto → +20%
 *
 * En Smart+ cada fila del radar es un video dentro del anuncio (su
 * smart_plus_creative_id), así que "pausar anuncio" del Piloto = pausar ese video.
 */
// Solo tipos: las reglas del Piloto llegan como parámetro (los módulos puros
// no se importan entre sí, así corren igual en la app y en node --test).
import type { PilotDayRow, PilotProposal } from "../radar/pilot";

export type BuildPilotProposals = (rows: PilotDayRow[]) => { proposals: PilotProposal[] };

export type LaunchRef = {
  id: string;
  advertiserId: string;
  campaignId: string;
  /** Presupuesto diario actual de la campaña. */
  dailyBudget: number;
  /** Techo para subir sin preguntar; null = el doble del presupuesto inicial. */
  maxDailyBudget: number | null;
  initialDailyBudget: number;
};

type Base = { id: string; launchId: string; advertiserId: string; campaignId: string };

export type LaunchAction =
  | (Base & {
      kind: "pause_video";
      creativeId: string;
      videoName: string;
      costPerResult: number | null;
      spend: number;
      campaignCostPerResult: number;
    })
  | (Base & { kind: "new_video"; creativeId: string; videoName: string; ctrDropPct: number })
  | (Base & { kind: "all_losing"; losers: number })
  | (Base & {
      kind: "raise_budget";
      fromBudget: number;
      toBudget: number;
      costPerResult: number;
      clientCostPerResult: number;
      cheaperPct: number;
    });

export const BUDGET_RULES = {
  /** Días de la ventana que se miran para el presupuesto. */
  recentDays: 3,
  /** Días con gasto antes de tocar el presupuesto (fuera del aprendizaje, igual que el Piloto). */
  minDaysActive: 4,
  minResults: 5,
  /** Costo por resultado vs. el promedio del cliente. */
  maxRatio: 0.8,
  /** Gastó al menos esto de su presupuesto el último día (el presupuesto lo frena). */
  minBudgetUse: 0.8,
  increasePct: 20,
} as const;

function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function addDays(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Acciones para las campañas lanzadas. `rows` son las filas del radar de todo
 * el cliente (sirven para su costo promedio); solo se proponen acciones sobre
 * las campañas de `launches`.
 */
export function buildLaunchActions(
  rows: PilotDayRow[],
  launches: LaunchRef[],
  options: { buildPilotProposals: BuildPilotProposals; dismissedIds?: ReadonlySet<string> },
): LaunchAction[] {
  const dismissed = options.dismissedIds ?? new Set<string>();
  let clientSpend = 0;
  let clientResults = 0;
  let dataThrough: string | null = null;
  for (const r of rows) {
    clientSpend += r.spend || 0;
    clientResults += r.results ?? 0;
    if (!dataThrough || r.statDate > dataThrough) dataThrough = r.statDate;
  }
  const clientCpr = clientResults > 0 ? clientSpend / clientResults : null;
  const actions: LaunchAction[] = [];

  for (const launch of launches) {
    const campaignRows = rows.filter((r) => r.advertiserId === launch.advertiserId && r.campaignId === launch.campaignId);
    if (campaignRows.length === 0) continue;
    const base = { launchId: launch.id, advertiserId: launch.advertiserId, campaignId: launch.campaignId };

    // Videos dentro de la campaña: reglas del Piloto con el promedio de la campaña.
    const pilot = options.buildPilotProposals(campaignRows);
    for (const p of pilot.proposals) {
      if (p.kind === "pause_loser" || p.kind === "pause_loser_same_group") {
        actions.push({
          ...base,
          id: `pause:${launch.campaignId}:${p.loser.adId}`,
          kind: "pause_video",
          creativeId: p.loser.adId,
          videoName: p.loser.adName,
          costPerResult: p.loserCostPerResult === null ? null : round(p.loserCostPerResult),
          spend: p.kind === "pause_loser" ? round(p.loserSpend) : 0,
          campaignCostPerResult: round(p.averageCostPerResult),
        });
      } else if (p.kind === "refresh_fatigued") {
        actions.push({
          ...base,
          id: `refresh:${launch.campaignId}:${p.ad.adId}`,
          kind: "new_video",
          creativeId: p.ad.adId,
          videoName: p.ad.adName,
          ctrDropPct: p.ctrDropPct,
        });
      } else if (p.kind === "all_losing") {
        actions.push({ ...base, id: `losing:${launch.campaignId}`, kind: "all_losing", losers: p.losers });
      }
    }

    // Presupuesto: la campaña entera frente al promedio del cliente.
    if (!dataThrough || clientCpr === null) continue;
    const from = addDays(dataThrough, -(BUDGET_RULES.recentDays - 1));
    const recent = campaignRows.filter((r) => r.statDate >= from);
    const spend = recent.reduce((s, r) => s + (r.spend || 0), 0);
    const results = recent.reduce((s, r) => s + (r.results ?? 0), 0);
    const daysActive = new Set(campaignRows.filter((r) => (r.spend || 0) > 0).map((r) => r.statDate)).size;
    const lastDaySpend = campaignRows.filter((r) => r.statDate === dataThrough).reduce((s, r) => s + (r.spend || 0), 0);
    if (daysActive < BUDGET_RULES.minDaysActive || results < BUDGET_RULES.minResults) continue;
    const cpr = spend / results;
    if (cpr > clientCpr * BUDGET_RULES.maxRatio) continue;
    if (lastDaySpend < launch.dailyBudget * BUDGET_RULES.minBudgetUse) continue;
    const cap = launch.maxDailyBudget ?? launch.initialDailyBudget * 2;
    const toBudget = round(Math.min(cap, launch.dailyBudget * (1 + BUDGET_RULES.increasePct / 100)));
    if (toBudget <= launch.dailyBudget) continue;
    actions.push({
      ...base,
      id: `budget:${launch.campaignId}:${dataThrough}`,
      kind: "raise_budget",
      fromBudget: launch.dailyBudget,
      toBudget,
      costPerResult: round(cpr),
      clientCostPerResult: round(clientCpr),
      cheaperPct: Math.round((1 - cpr / clientCpr) * 100),
    });
  }

  return actions.filter((a) => !dismissed.has(a.id));
}
