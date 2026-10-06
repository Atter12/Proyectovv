/**
 * Rendimiento por producto: agrupa las campañas por el producto que se lee en
 * su nombre y marca cuál conviene escalar, mantener, revisar o apagar.
 *
 * El producto se deduce del nombre (no hay un campo «producto» en TikTok), con
 * los formatos que usan los clientes:
 *   TESTEO/SAFEBONE/WEB/25SEP2026      → SAFEBONE
 *   PR2109_TEST_GLUCORA_PE_A_v215      → GLUCORA
 *   PR1109 | TIROBALANCE V7 CAP 4.5    → TIROBALANCE
 *   OREGANO/TEST2/02 · oregano / 2.00  → OREGANO
 *   SMART CREATINE GUMMIES V2          → SMART CREATINE GUMMIES
 *   Copia 1 de Madrid                  → MADRID
 */

/** Campañas sin producto reconocible (promos, nombres de cuenta). */
export const OTHERS = "OTROS";

const CAMPAIGN_TYPES = new Set(["TESTEO", "TESTO", "TEST", "CBO", "ABO", "ESCALA", "ESCALADO", "SCALE", "RMK", "RETARGETING"]);
const NOISE_WORDS = new Set([
  "PE", "CO", "EC", "BR", "MX", "ES", "ABO", "CBO", "TEST", "TESTEO", "WEB", "LABS", "NUEVO", "NUEVOS", "NEW",
  "VENTAS", "WINNERS", "WINNER", "BENDECIDAS", "ESCALADO", "RESCATE", "PUJA", "LINEUP", "A", "B", "C", "X", "Y",
]);

function isNoise(token: string): boolean {
  const t = token.toUpperCase();
  return (
    !t ||
    NOISE_WORDS.has(t) ||
    /^PR\d{3,4}$/.test(t) ||
    /^V\d+([.,]\d+)?$/.test(t) ||
    /^T\d+([.,]\d+)?$/.test(t) ||
    /^TEST\d+([.,]\d+)?$/.test(t) ||
    /^L\d+$/.test(t) ||
    /^\$?\d+([.,:]\d+)*\$?$/.test(t) ||
    /^\d{1,2}(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)\w*$/.test(t) ||
    /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)$/.test(t) ||
    /^[A-Z]$/.test(t) ||
    /^\d+X\d+!*$/.test(t) ||
    /^-+\d*$/.test(t)
  );
}

function clean(raw: string): string {
  return raw
    .replace(/^(\s*(copia|copy)\s+\d+\s+(de|of)\s+)+/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productFromCampaignName(raw: string | null | undefined): string {
  const name = clean(String(raw ?? ""));
  if (!name) return OTHERS;
  // Filas que traen el nombre de la cuenta en lugar de la campaña.
  if (/\|\d{10,}\|/.test(name)) return OTHERS;

  // TESTEO/PRODUCTO/... · CBO/PRODUCTO/...
  const slash = name.split("/").map((s) => s.trim()).filter(Boolean);
  if (slash.length >= 2 && CAMPAIGN_TYPES.has(slash[0].toUpperCase())) {
    return slash[1].toUpperCase();
  }

  // PR2109_TEST_GLUCORA_PE_... · LINFATICO_PE_1109_...
  if (/^[^\s|/]+_[^\s|/]+/.test(name)) {
    const token = name.split("_").find((t) => !isNoise(t));
    if (token) return token.toUpperCase();
  }

  // PR1109 | TIROBALANCE V7 ... · 2009 | NAD+MAX PUJA
  if (name.includes("|")) {
    for (const part of name.split("|")) {
      const word = part.trim().split(" ").find((t) => !isNoise(t));
      if (word) return word.toUpperCase();
    }
  }

  // OREGANO/TEST2/02 · DRENAJE/TEST1.02 · oregano / 2.00 / 27set26
  if (slash.length >= 2) {
    const words = slash[0].split(" ").filter((t) => !isNoise(t));
    if (words.length) return words.slice(0, 3).join(" ").toUpperCase();
  }

  // Texto libre: SMART CREATINE GUMMIES V2 · Zapatillas Andex 1 · Madrid
  const words = name
    .replace(/[-–]\s*\d+\s*[-–]?/g, " ")
    .replace(/[!.…]+$/g, "")
    .split(" ")
    .map((w) => w.replace(/^[-–(]+|[-–),.:]+$/g, ""))
    .filter((w) => !isNoise(w));
  return words.length ? words.slice(0, 3).join(" ").toUpperCase() : OTHERS;
}

export type ProductVerdict = "scale" | "keep" | "review" | "stop" | "low_data" | "no_data";

export type ProductCampaignInput = {
  campaignName: string;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
};

export type ProductRow = {
  product: string;
  campaigns: string[];
  spend: number;
  spendShare: number;
  conversions: number | null;
  costPerResult: number | null;
  ctr: number | null;
  verdict: ProductVerdict;
  /** CPA del producto ÷ CPA promedio del cliente (1 = igual). */
  vsAverage: number | null;
};

/** Gasto mínimo para opinar sobre un producto (menos es ruido). */
export const MIN_SPEND_FOR_VERDICT = 15;

export function buildProductPerformance(campaigns: ProductCampaignInput[]): {
  rows: ProductRow[];
  averageCostPerResult: number | null;
  hasConversions: boolean;
} {
  const groups = new Map<string, { campaigns: string[]; spend: number; conv: number; convKnown: boolean; imp: number; clicks: number }>();
  for (const c of campaigns) {
    if (!(c.spend > 0)) continue;
    const key = productFromCampaignName(c.campaignName);
    const g = groups.get(key) ?? { campaigns: [], spend: 0, conv: 0, convKnown: false, imp: 0, clicks: 0 };
    g.campaigns.push(c.campaignName);
    g.spend += c.spend;
    if (c.conversions != null) {
      g.conv += c.conversions;
      g.convKnown = true;
    }
    g.imp += c.impressions ?? 0;
    g.clicks += c.clicks ?? 0;
    groups.set(key, g);
  }

  const totalSpend = [...groups.values()].reduce((s, g) => s + g.spend, 0);
  const hasConversions = [...groups.values()].some((g) => g.convKnown);
  const knownSpend = [...groups.values()].filter((g) => g.convKnown).reduce((s, g) => s + g.spend, 0);
  const knownConv = [...groups.values()].filter((g) => g.convKnown).reduce((s, g) => s + g.conv, 0);
  const averageCostPerResult = knownConv > 0 ? knownSpend / knownConv : null;

  const rows: ProductRow[] = [...groups.entries()].map(([product, g]) => {
    const spend = Math.round(g.spend * 100) / 100;
    const conversions = g.convKnown ? g.conv : null;
    const costPerResult = conversions && conversions > 0 ? spend / conversions : null;
    const vsAverage = costPerResult != null && averageCostPerResult ? costPerResult / averageCostPerResult : null;
    let verdict: ProductVerdict;
    if (conversions == null) verdict = "no_data";
    else if (spend < MIN_SPEND_FOR_VERDICT) verdict = "low_data";
    else if (conversions === 0) verdict = "stop";
    else if (vsAverage != null && vsAverage <= 0.85) verdict = "scale";
    else if (vsAverage != null && vsAverage >= 1.4) verdict = "review";
    else verdict = "keep";
    return {
      product,
      campaigns: g.campaigns,
      spend,
      spendShare: totalSpend > 0 ? spend / totalSpend : 0,
      conversions,
      costPerResult: costPerResult != null ? Math.round(costPerResult * 100) / 100 : null,
      ctr: g.imp > 0 ? Math.round((g.clicks / g.imp) * 10000) / 100 : null,
      verdict,
      vsAverage: vsAverage != null ? Math.round(vsAverage * 100) / 100 : null,
    };
  });
  rows.sort((a, b) => b.spend - a.spend);
  return { rows, averageCostPerResult: averageCostPerResult != null ? Math.round(averageCostPerResult * 100) / 100 : null, hasConversions };
}
