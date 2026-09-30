/** Monitoreo de prepago (solo gerencia). Ver lib/ops/prepago-monitor.server.ts. */

export type MonitorSeverity = "critical" | "high" | "medium" | "info";

export type MonitorSignalKind =
  | "unlimited"
  | "budget_over_wallet"
  | "cash_without_wallet"
  | "manual_bc_load"
  | "staff_recharge"
  | "tiktok_import"
  | "unrecorded_spend"
  | "month_debt";

export type MonitorSignal = {
  kind: MonitorSignalKind;
  severity: MonitorSeverity;
  title: string;
  detail: string;
  /** Qué hacer, en una línea. */
  action: string;
  advertiserId: string | null;
  amountUsd: number | null;
};

export type MonitorAccount = {
  advertiserId: string;
  name: string;
  bm: string;
  kind: "shared" | "cash";
  status: "active" | "banned" | "other";
  unlimited: boolean;
  /** Lo que TikTok deja gastar hoy (null = sin tope). */
  spendableUsd: number | null;
  walletUsd: number;
  /** Lo que puede gastar sin haber pagado (null = sin tope). */
  excessUsd: number | null;
  spentTotalUsd: number;
};

export type MonitorCliente = {
  id: string;
  name: string;
  hasLogin: boolean;
  severity: MonitorSeverity;
  /** USD que hoy puede gastar sin pago detrás. */
  exposureUsd: number;
  walletUsd: number;
  tiktokSpendableUsd: number;
  unlimitedAccounts: number;
  month: { chargeUsd: number; paidUsd: number; debtUsd: number };
  spendYesterdayUsd: number;
  signals: MonitorSignal[];
  accounts: MonitorAccount[];
};

export type MonitorEvent = {
  id: string;
  at: string;
  kind: "manual_bc_load" | "staff_recharge" | "tiktok_import";
  severity: MonitorSeverity;
  clienteId: string;
  clienteName: string;
  title: string;
  detail: string;
  amountUsd: number;
  actor: string | null;
};

export type MonitorSnapshot = {
  generatedAt: string;
  durationMs: number;
  cached: boolean;
  month: string;
  windows: { manualLoadHours: number; staffMovesDays: number };
  totals: {
    clientes: number;
    accounts: number;
    critical: number;
    high: number;
    medium: number;
    ok: number;
    exposureUsd: number;
    unlimitedAccounts: number;
    monthDebtUsd: number;
    staffRechargeUsd: number;
    manualLoadUsd: number;
    tiktokImportUsd: number;
  };
  clientes: MonitorCliente[];
  events: MonitorEvent[];
  warnings: string[];
};
