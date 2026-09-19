/**
 * Score de cliente solo para gerencia. Determinista: no usa LLM.
 * 0–100. Sin gasto TikTok no se califica (no inventar “buen cliente”).
 */

export type ClienteScoreVerdict = "good" | "ok" | "watch" | "risk" | "no_base";

export type ClienteScoreFactorId = "ads" | "credit" | "collections" | "tickets";

export type ClienteScoreNote =
  | "ads_none"
  | "ads_strong"
  | "ads_mid"
  | "ads_weak"
  | "credit_ok"
  | "credit_watch"
  | "credit_risk"
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
  spend7d: number;
  spend30d: number;
  pacingLabel: string;
  avgCtr: number | null;
  clicks: number;
  conversions: number;
  impressions: number;
  hasCodLink: boolean;
  aboveBreakEven: boolean | null;
  /** Señales warn/critical ya calculadas (concentration, low_ctr, weak_roas…). */
  warnKinds: string[];
  burnStatus: "critical" | "warn" | "info" | "none";
  /** null = no se pudo leer payment_intents. */
  failedPayments45d: number | null;
  paymentIntents45d: number | null;
  /** null = no se pudo leer support_tickets. */
  openTickets: number | null;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreAds(input: ClienteScoreInput): ClienteScoreFactor {
  const hasSpend = input.spend7d > 0 || input.spend30d > 0;
  const hasPerf = input.clicks > 0 || input.impressions > 0;
  if (!hasSpend && !hasPerf) {
    return { id: "ads", points: null, note: "ads_none" };
  }

  let pts = hasSpend && input.spend7d > 0 ? 52 : 40;
  if (input.avgCtr != null) {
    if (input.avgCtr >= 1) pts += 18;
    else if (input.avgCtr >= 0.5) pts += 10;
    else if (input.avgCtr < 0.25 && input.impressions >= 800) pts -= 14;
  }

  if (input.clicks >= 40) {
    const cvr = (input.conversions / input.clicks) * 100;
    if (cvr >= 2) pts += 16;
    else if (cvr >= 0.8) pts += 8;
    else if (input.conversions === 0 && input.spend7d >= 15) pts -= 18;
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
  let pts =
    input.burnStatus === "critical"
      ? 16
      : input.burnStatus === "warn"
        ? 42
        : input.burnStatus === "info"
          ? 68
          : 82;

  if (input.pacingLabel === "acelerando") pts -= 12;
  else if (input.pacingLabel === "normal") pts += 8;
  else if (input.pacingLabel === "bajo" || input.pacingLabel === "parado") {
    pts -= 6;
  }

  const points = clamp(pts);
  const note: ClienteScoreNote =
    points >= 70 ? "credit_ok" : points >= 45 ? "credit_watch" : "credit_risk";
  return { id: "credit", points, note };
}

function scoreCollections(input: ClienteScoreInput): ClienteScoreFactor {
  if (input.paymentIntents45d == null || input.failedPayments45d == null) {
    return { id: "collections", points: null, note: "collections_unknown" };
  }
  if (input.paymentIntents45d === 0) {
    return { id: "collections", points: 72, note: "collections_none" };
  }
  const failed = input.failedPayments45d;
  const points = clamp(94 - failed * 24);
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

function verdictFor(score: number): ClienteScoreVerdict {
  if (score >= 78) return "good";
  if (score >= 60) return "ok";
  if (score >= 42) return "watch";
  return "risk";
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
  const score = clamp(
    weighted.reduce((sum, row) => sum + (row.points * row.weight) / weightSum, 0),
  );

  return { score, verdict: verdictFor(score), factors };
}
