/**
 * Semáforo de riesgo solo para gerencia. Determinista: no usa LLM.
 * El número es riesgo, no “qué tan buen cliente”: 0–29 verde, 30–59 amarillo,
 * 60–79 naranja, 80–100 rojo. Sin gasto TikTok no se califica.
 *
 * Ventanas fijas (no el filtro Hoy de Profit):
 * - Ads / performance: 30d (7d solo pacing)
 * - Pagos / crédito: 90d asignado vs gastado
 * - Cobros: depósitos Holistic 90d (no basura Stripe cancelled)
 */

export type ClienteScoreVerdict =
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "no_base";

export type ClienteScoreFactorId = "ads" | "credit" | "collections" | "tickets";

export type ClienteScoreNote =
  | "ads_none"
  | "ads_strong"
  | "ads_mid"
  | "ads_weak"
  | "credit_ok"
  | "credit_watch"
  | "credit_risk"
  | "credit_burn_fast"
  | "credit_agency"
  | "collections_unknown"
  | "collections_none"
  | "collections_clean"
  | "collections_one"
  | "collections_many"
  | "tickets_unknown"
  | "tickets_clear"
  | "tickets_open";

export type ClienteScoreFactor = {
  id: ClienteScoreFactorId;
  /** 0–100. null = este pilar no entró al promedio. */
  points: number | null;
  note: ClienteScoreNote;
};

export type ClienteScore = {
  score: number | null;
  verdict: ClienteScoreVerdict;
  factors: ClienteScoreFactor[];
};

export type ClienteScoreInput = {
  /** Gasto 7d (pacing / actividad reciente). */
  spend7d: number;
  /** Gasto 30d — base del pilar publicidad. */
  spend30d: number;
  pacingLabel: string;
  /** CTR / clicks / conv / impresiones del ancla 30d. */
  avgCtr: number | null;
  clicks: number;
  conversions: number;
  impressions: number;
  hasCodLink: boolean;
  aboveBreakEven: boolean | null;
  /** Señales warn/critical ya calculadas (concentration, low_ctr, weak_roas…). */
  warnKinds: string[];
  /** Burn corto (48h) — alerta, no dueño del pilar. */
  burnStatus: "critical" | "warn" | "info" | "none";
  /** Asignaciones Holistic 90d (USD). null = no se pudo leer. */
  allocated90dUsd: number | null;
  /** Gasto ads atribuible 90d (USD). null = no se pudo leer. */
  spent90dUsd: number | null;
  /**
   * Depósitos Holistic confirmados 90d.
   * null = no se pudo leer ledger.
   */
  deposits90d: number | null;
  /**
   * Fallos reales de cobro Holistic 90d (no cancelled de Stripe).
   * null = no se pudo leer.
   */
  failedDeposits90d: number | null;
  /** null = no se pudo leer support_tickets. */
  openTickets: number | null;
  /**
   * Ficha Hecom de crédito agencia. El cupo de Manager no es hueco de prepago.
   * Default false: si no se sabe, el score de prepago no cambia.
   */
  agencyCredit?: boolean;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreAds(input: ClienteScoreInput): ClienteScoreFactor {
  const hasSpend = input.spend30d > 0 || input.spend7d > 0;
  const hasPerf = input.clicks > 0 || input.impressions > 0;
  if (!hasSpend && !hasPerf) {
    return { id: "ads", points: null, note: "ads_none" };
  }

  // Base anclada a 30d (estable aunque Profit esté en “hoy”).
  let pts = input.spend30d > 0 ? 54 : input.spend7d > 0 ? 46 : 40;

  if (input.avgCtr != null) {
    if (input.avgCtr >= 1) pts += 18;
    else if (input.avgCtr >= 0.5) pts += 10;
    else if (input.avgCtr < 0.25 && input.impressions >= 800) pts -= 14;
  }

  if (input.clicks >= 40) {
    const cvr = (input.conversions / input.clicks) * 100;
    if (cvr >= 2) pts += 16;
    else if (cvr >= 0.8) pts += 8;
    else if (input.conversions === 0 && input.spend30d >= 40) pts -= 18;
  } else if (input.conversions > 0) {
    pts += 6;
  }

  if (input.warnKinds.includes("low_ctr")) pts -= 8;
  if (input.warnKinds.includes("concentration")) pts -= 8;
  if (input.hasCodLink && input.aboveBreakEven === false) pts -= 10;
  if (input.hasCodLink && input.aboveBreakEven === true) pts += 8;

  const points = clamp(pts);
  const note: ClienteScoreNote =
    points >= 70 ? "ads_strong" : points >= 48 ? "ads_mid" : "ads_weak";
  return { id: "ads", points, note };
}

function scoreCredit(input: ClienteScoreInput): ClienteScoreFactor {
  if (input.agencyCredit) {
    return { id: "credit", points: 78, note: "credit_agency" };
  }

  const allocated = input.allocated90dUsd;
  const spent = input.spent90dUsd;

  let pts = 72;
  let note: ClienteScoreNote = "credit_ok";

  if (allocated != null && spent != null && allocated > 0) {
    const ratio = spent / allocated;
    // ratio > 1 es común en BM SHARED (cupo TikTok previo). No tumbar a rojo solo por eso.
    if (ratio <= 0.85) pts = 84;
    else if (ratio <= 1.05) pts = 72;
    else if (ratio <= 1.4) pts = 58;
    else pts = 46;
  } else if (allocated === 0 && (spent == null || spent <= 0)) {
    pts = 74;
  } else if (allocated == null || spent == null) {
    // Sin historial 90d: caer al burn corto + pacing.
    pts =
      input.burnStatus === "critical"
        ? 24
        : input.burnStatus === "warn"
          ? 48
          : input.burnStatus === "info"
            ? 70
            : 78;
  }

  // Burn 48h ajusta, no monopoliza.
  if (input.burnStatus === "critical") pts -= 22;
  else if (input.burnStatus === "warn") pts -= 12;
  else if (input.burnStatus === "info") pts -= 4;

  if (input.pacingLabel === "acelerando") pts -= 8;
  else if (input.pacingLabel === "normal") pts += 4;
  else if (input.pacingLabel === "bajo" || input.pacingLabel === "parado") {
    pts -= 4;
  }

  const points = clamp(pts);

  if (input.burnStatus === "critical" || input.burnStatus === "warn") {
    note = points < 45 ? "credit_risk" : "credit_burn_fast";
  } else if (points >= 70) {
    note = "credit_ok";
  } else if (points >= 45) {
    note = "credit_watch";
  } else {
    note = "credit_risk";
  }

  return { id: "credit", points, note };
}

function scoreCollections(input: ClienteScoreInput): ClienteScoreFactor {
  if (input.deposits90d == null || input.failedDeposits90d == null) {
    return { id: "collections", points: null, note: "collections_unknown" };
  }

  const deposits = input.deposits90d;
  const failed = input.failedDeposits90d;

  if (deposits === 0 && failed === 0) {
    return { id: "collections", points: 72, note: "collections_none" };
  }

  // Depósitos Holistic reales pesan; fallos reales castigan.
  const points = clamp(
    deposits > 0
      ? 96 - failed * 22
      : Math.max(20, 70 - failed * 24),
  );
  const note: ClienteScoreNote =
    failed <= 0
      ? "collections_clean"
      : failed === 1
        ? "collections_one"
        : "collections_many";
  return { id: "collections", points, note };
}

function scoreTickets(input: ClienteScoreInput): ClienteScoreFactor {
  if (input.openTickets == null) {
    return { id: "tickets", points: null, note: "tickets_unknown" };
  }
  const n = input.openTickets;
  const points = n === 0 ? 90 : n === 1 ? 68 : n === 2 ? 48 : 28;
  const note: ClienteScoreNote = n === 0 ? "tickets_clear" : "tickets_open";
  return { id: "tickets", points, note };
}

/** Riesgo alto = peor. Los cortes son los del semáforo de gerencia. */
function verdictFor(risk: number): ClienteScoreVerdict {
  if (risk <= 29) return "green";
  if (risk <= 59) return "yellow";
  if (risk <= 79) return "orange";
  return "red";
}

export function computeClienteScore(input: ClienteScoreInput): ClienteScore {
  const ads = scoreAds(input);
  const credit = scoreCredit(input);
  const collections = scoreCollections(input);
  const tickets = scoreTickets(input);
  const factors = [ads, credit, collections, tickets];

  if (ads.points == null) {
    return { score: null, verdict: "no_base", factors };
  }

  const weighted: Array<{ points: number; weight: number }> = [
    { points: ads.points, weight: 0.45 },
    { points: credit.points ?? 0, weight: credit.points == null ? 0 : 0.3 },
    {
      points: collections.points ?? 0,
      weight: collections.points == null ? 0 : 0.15,
    },
    { points: tickets.points ?? 0, weight: tickets.points == null ? 0 : 0.1 },
  ].filter((row) => row.weight > 0);

  const weightSum = weighted.reduce((sum, row) => sum + row.weight, 0);
  const health = clamp(
    weighted.reduce((sum, row) => sum + (row.points * row.weight) / weightSum, 0),
  );
  const risk = clamp(100 - health);

  return { score: risk, verdict: verdictFor(risk), factors };
}
