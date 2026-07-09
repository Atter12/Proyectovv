import type { PaymentFlowDayPoint, WalletExposurePoint } from "@/lib/admin/data";

export type PaymentFlowRange = "7D" | "15D" | "30D";

export const PAYMENT_FLOW_RANGE_DAYS: Record<PaymentFlowRange, number> = {
  "7D": 7,
  "15D": 15,
  "30D": 30,
};

export function countPaymentFlowActiveDays(data: PaymentFlowDayPoint[]): number {
  return data.filter(
    (point) => point.created > 0 || point.completed > 0 || point.pending > 0 || point.processedCents > 0,
  ).length;
}

export function slicePaymentFlowByRange(data: PaymentFlowDayPoint[], range: PaymentFlowRange): PaymentFlowDayPoint[] {
  return data.slice(-PAYMENT_FLOW_RANGE_DAYS[range]);
}

export function suggestPaymentFlowRange(data: PaymentFlowDayPoint[]): PaymentFlowRange {
  const active30 = countPaymentFlowActiveDays(data);
  if (active30 === 0) return "30D";
  if (active30 < 5) return "7D";
  if (active30 < 10) return "15D";

  const active7 = countPaymentFlowActiveDays(data.slice(-7));
  if (active7 > 0 && active7 >= active30 * 0.75) return "7D";

  return "30D";
}

export interface PaymentFlowRangeTotals {
  processedCents: number;
  completed: number;
  pending: number;
  resolutionRate: number | null;
}

export function summarizePaymentFlowRange(data: PaymentFlowDayPoint[]): PaymentFlowRangeTotals {
  let processedCents = 0;
  let completed = 0;
  let pending = 0;

  for (const point of data) {
    processedCents += point.processedCents;
    completed += point.completed;
    pending += point.pending;
  }

  const resolvable = completed + pending;
  const resolutionRate = resolvable > 0 ? Math.round((completed / resolvable) * 100) : null;

  return { processedCents, completed, pending, resolutionRate };
}

export function formatOrganizationDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  if (trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed.replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase("es"));
}

export function filterWalletExposureWithBalance(data: WalletExposurePoint[], limit = 10): WalletExposurePoint[] {
  return data
    .filter((item) => item.availableCents + item.reservedCents > 0)
    .slice(0, limit);
}

export interface WalletExposureTotals {
  availableCents: number;
  reservedCents: number;
  topOrganizationName: string | null;
}

export interface WalletExposureRankingItem extends WalletExposurePoint {
  exposureCents: number;
  concentrationShare: number;
}

export interface WalletExposureInsights {
  totalAvailable: number;
  totalReserved: number;
  totalExposure: number;
  topOrganizationName: string | null;
  topConcentrationShare: number;
  concentrationLevel: WalletConcentrationLevel;
  activeWalletOrganizationsCount: number;
  ranked: WalletExposureRankingItem[];
}

export type WalletConcentrationLevel = "alta" | "media" | "baja";

export function resolveWalletConcentrationLevel(topShare: number): WalletConcentrationLevel {
  if (topShare >= 70) return "alta";
  if (topShare >= 40) return "media";
  return "baja";
}

export function formatWalletConcentrationLevelLabel(level: WalletConcentrationLevel): string {
  if (level === "alta") return "Alta";
  if (level === "media") return "Media";
  return "Baja";
}

export function formatConcentrationShare(share: number): string {
  if (share > 0 && share < 0.1) return "<0.1%";
  return `${share.toFixed(1)}%`;
}

export function summarizeWalletExposure(data: WalletExposurePoint[]): WalletExposureTotals {
  const withBalance = filterWalletExposureWithBalance(data, data.length);
  let availableCents = 0;
  let reservedCents = 0;

  for (const item of withBalance) {
    availableCents += item.availableCents;
    reservedCents += item.reservedCents;
  }

  const sorted = [...withBalance].sort(
    (left, right) => right.availableCents + right.reservedCents - (left.availableCents + left.reservedCents),
  );

  return {
    availableCents,
    reservedCents,
    topOrganizationName: sorted[0]?.organizationName ?? null,
  };
}

export function buildWalletExposureInsights(data: WalletExposurePoint[], limit = 5): WalletExposureInsights {
  const withBalance = [...filterWalletExposureWithBalance(data, data.length)].sort(
    (left, right) => right.availableCents + right.reservedCents - (left.availableCents + left.reservedCents),
  );

  let totalAvailable = 0;
  let totalReserved = 0;

  for (const item of withBalance) {
    totalAvailable += item.availableCents;
    totalReserved += item.reservedCents;
  }

  const totalExposure = totalAvailable + totalReserved;

  const ranked: WalletExposureRankingItem[] = withBalance.slice(0, limit).map((item) => {
    const exposureCents = item.availableCents + item.reservedCents;
    return {
      ...item,
      exposureCents,
      concentrationShare: totalExposure > 0 ? (exposureCents / totalExposure) * 100 : 0,
    };
  });

  const topConcentrationShare = ranked[0]?.concentrationShare ?? 0;

  return {
    totalAvailable,
    totalReserved,
    totalExposure,
    topOrganizationName: withBalance[0]?.organizationName ?? null,
    topConcentrationShare,
    concentrationLevel: resolveWalletConcentrationLevel(topConcentrationShare),
    activeWalletOrganizationsCount: withBalance.length,
    ranked,
  };
}
