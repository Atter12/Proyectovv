import type { AdminMetricAccent } from "./AdminMetricCard";
import { formatMoney } from "@/lib/format";

type OverviewCounts = {
  organizations: number;
  profiles: number;
  totalWalletBalanceCents: number;
  totalReservedCents: number;
  primaryCurrency: string;
  pendingPayments: number;
  openTickets: number;
  failedWebhooks: number;
};

export type AdminOverviewMetric = {
  label: string;
  value: string;
  detail?: string;
  accent: AdminMetricAccent;
  emphasized?: boolean;
};

export function buildOverviewMetrics(
  counts: OverviewCounts,
  operationalAlerts: number,
): AdminOverviewMetric[] {
  return [
    {
      label: "Organizaciones",
      value: String(counts.organizations),
      detail: counts.profiles > 0 ? `${counts.profiles} perfiles registrados` : "Sin perfiles registrados",
      accent: "indigo",
    },
    {
      label: "Saldo wallets",
      value: formatMoney(counts.totalWalletBalanceCents, counts.primaryCurrency),
      detail:
        counts.totalReservedCents > 0
          ? `${formatMoney(counts.totalReservedCents, counts.primaryCurrency)} reservado`
          : "Sin saldo reservado",
      accent: "emerald",
    },
    {
      label: "Pagos por revisar",
      value: String(counts.pendingPayments),
      detail: counts.pendingPayments > 0 ? "Manual / voucher pendiente" : "Cola limpia",
      accent: "amber",
    },
    {
      label: "Alertas operativas",
      value: String(operationalAlerts),
      detail:
        operationalAlerts > 0
          ? `${counts.openTickets} tickets · ${counts.failedWebhooks} webhooks`
          : "Sin incidencias",
      accent: "rose",
      emphasized: operationalAlerts > 0,
    },
  ];
}
