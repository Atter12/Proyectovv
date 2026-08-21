import Link from "next/link";
import { routes } from "@/config/routes";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { OverviewClientTitle } from "@/features/clientes/components/OverviewClientTitle.client";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
} from "@/lib/hecom/gasto-label";
import {
  moneyUsd,
  type HecomClienteDashboard,
  type HecomGastoRow,
} from "@/lib/hecom/cliente-dashboard.server";
import type { HecomTiktokAccount } from "@/lib/hecom/clientes.server";

function parseAdvertiserLabel(raw: string | null) {
  if (!raw?.trim()) {
    return {
      title: "TikTok Ads",
      balance: null as string | null,
      tag: null as string | null,
    };
  }
  const match = raw.match(
    /^(.*?)\s+(\d+(?:\.\d+)?\s*USD)\s*[-–]\s*(.+)$/i,
  );
  if (match) {
    return {
      title: match[1].trim(),
      balance: match[2].replace(/\s+/g, " ").trim(),
      tag: match[3].trim(),
    };
  }
  return { title: raw.trim(), balance: null, tag: null };
}

function sourceLabel(source: HecomClienteDashboard["source"]) {
  return source === "hecom_live" ? "En vivo" : "Backup";
}

function shortId(id: string) {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/**
 * Overview del cliente — desktop + móvil (cards / KPIs 2×2 / chart scroll).
 * Referencia visual: operación Hecom light Holistic (naranja, sin purple).
 */
export function ClienteScopedOverview({
  data,
  canChangeCliente = false,
}: {
  data: HecomClienteDashboard;
  canChangeCliente?: boolean;
}) {
  const { cliente, summary, accounts, gastos } = data;
  const recentGastos = gastos.slice(0, 8);
  const debt = summary.saldoEstimado < 0;
  const activeAccounts = accounts.filter((a) => a.syncEnabled !== false).length;
  const pausedAccounts = Math.max(0, accounts.length - activeAccounts);

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-7">
      {/* Hero */}
      <section className="dashboard-surface-card overflow-hidden rounded-[1.05rem]">
        <div className="grid gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="lg"
                className="ring-2 ring-white"
              />
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
                  Operación Hecom Club
                </p>
                {cliente.biz ? (
                  <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-soft)]">
                    {cliente.biz}
                  </p>
                ) : null}
              </div>
            </div>

            <OverviewClientTitle name={cliente.name} />

            <p className="mt-2 max-w-xl text-[13.5px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[14px]">
              {canChangeCliente
                ? "Gestioná cuentas TikTok y el saldo Hecom del cliente operativo."
                : "Tus cuentas TikTok, cobros y gasto ads. Recargá con Stripe en Pagos."}{" "}
              Fee Holistic de este cliente:{" "}
              <span className="font-bold text-[var(--auth-text)]">
                {summary.depositFeePercent}%
              </span>{" "}
              (Hecom Club). Al recargar ponés el neto; se cobra neto + fee.
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--auth-accent)]/30 bg-[var(--auth-accent-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--auth-accent)]">
              Fee Hecom {summary.depositFeePercent}%
              <span className="font-medium text-[var(--auth-text-muted)]">
                · depósitos → neto a cartera
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:flex-row sm:flex-wrap">
              <Link
                href={routes.payments}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--auth-accent)] px-4 text-[13.5px] font-bold text-white shadow-[0_10px_22px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.04] active:translate-y-px sm:h-10 sm:w-auto sm:rounded-lg sm:shadow-none"
              >
                <WalletIcon />
                {canChangeCliente ? "Recargar / asignar" : "Recargar"}
              </Link>
              <Link
                href={routes.adAccounts}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--auth-accent)]/45 bg-white px-4 text-[13.5px] font-bold text-[var(--auth-accent)] transition-colors hover:bg-[var(--auth-accent-soft)] sm:h-10 sm:w-auto sm:rounded-lg"
              >
                <ChartIcon />
                Ver cuentas
              </Link>
              {canChangeCliente ? (
                <Link
                  href={routes.clientes}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg px-3 text-[13px] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)] sm:w-auto"
                >
                  Cambiar cliente
                </Link>
              ) : null}
            </div>
          </div>

          <div className="w-full rounded-[1rem] border border-[var(--auth-border)] bg-[var(--auth-bg)] p-4 sm:p-5 lg:min-w-[260px] lg:max-w-sm">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
              {debt ? "Deuda neta" : "Saldo estimado"}
            </p>
            <p
              className={`mt-2 text-[1.85rem] font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-[2rem] ${
                debt ? "text-[#b45309]" : "text-[var(--auth-text)]"
              }`}
            >
              {moneyUsd(summary.saldoEstimado)}
            </p>
            <p className="mt-3 text-[12px] leading-5 text-[var(--auth-text-muted)]">
              Cobros {moneyUsd(summary.cobroTotal)} − gastos{" "}
              {moneyUsd(summary.gastoTotal)} − fees{" "}
              {moneyUsd(summary.feeTotal)}
            </p>
            <p className="mt-2 text-[11px] leading-4 text-[var(--auth-text-soft)]">
              La recarga BM no baja esta deuda: solo un cobro Hecom.
            </p>
          </div>
        </div>
      </section>

      {/* KPIs detalle — tablet/desktop */}
      <section className="hidden grid-cols-2 gap-2.5 sm:grid sm:gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Fee Holistic"
          value={`${summary.depositFeePercent}%`}
          accent
          hint="Desde Hecom Club"
        />
        <Kpi
          label="Gasto de hoy"
          value={moneyUsd(summary.gastoHoy)}
          hint={
            summary.dailySource === "none"
              ? "Sin sync del día"
              : summary.gastoHoy > 0
                ? "America/Lima"
                : "Sin actividad hoy"
          }
        />
        <Kpi label="Últimos 7 días" value={moneyUsd(summary.gasto7d)} />
        <Kpi
          label="Cuentas TikTok"
          value={String(summary.accountCount)}
          hint={
            accounts.length
              ? `${activeAccounts} activas · ${pausedAccounts} pausadas`
              : undefined
          }
        />
        <Kpi label="Cobros" value={moneyUsd(summary.cobroTotal)} />
        <Kpi label="Gastos ads" value={moneyUsd(summary.gastoTotal)} />
      </section>

      {/* Resumen rápido estilo mock — solo móvil */}
      <section className="grid grid-cols-2 gap-2.5 sm:hidden">
        <SummaryChip
          icon="wallet"
          label="Saldo estimado"
          value={moneyUsd(summary.saldoEstimado)}
          hint="Total Hecom"
          accent={!debt}
          warn={debt}
        />
        <SummaryChip
          icon="trend"
          label="Fee Holistic"
          value={`${summary.depositFeePercent}%`}
          hint="Hecom Club"
          accent
        />
        <SummaryChip
          icon="clock"
          label="Gasto hoy"
          value={moneyUsd(summary.gastoHoy)}
          hint="America/Lima"
          accent
        />
        <SummaryChip
          icon="pause"
          label="Pausadas"
          value={`${pausedAccounts}`}
          hint="Sin sync"
        />
      </section>

      <DailySpendPanel
        series={summary.dailySeries}
        gastoHoy={summary.gastoHoy}
        gasto7d={summary.gasto7d}
        gasto30d={summary.gasto30d}
        source={summary.dailySource}
      />

      <section>
        <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
          Accesos rápidos
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <ActionTile
            href={routes.adAccounts}
            title="Cuentas ads"
            body="Advertisers TikTok mapeados."
          />
          <ActionTile
            href={routes.payments}
            title="Pagos"
            body="Recarga BM o cartera."
          />
          <ActionTile
            href={`${routes.payments}#asignar-saldo`}
            title="Asignar saldo"
            body="Presupuesto hacia ads."
          />
        </div>
      </section>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        <AccountsPanel accounts={accounts} />
        <GastosPanel gastos={recentGastos} source={data.source} />
      </div>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4 8.5 6 5.2A1.8 1.8 0 0 1 7.6 4.5h8.8A1.8 1.8 0 0 1 18 5.2L20 8.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="16.5" cy="13.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8 15v-3M12 15V8M16 15v-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function dailySourceLabel(
  source: HecomClienteDashboard["summary"]["dailySource"],
) {
  if (source === "snapshots") return "TikTok sync";
  if (source === "gastos") return "Hecom gastos";
  return "Sin datos";
}

function shortDayLabel(dateYmd: string) {
  const iso = dateYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateYmd;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function DailySpendPanel({
  series,
  gastoHoy,
  gasto7d,
  gasto30d,
  source,
}: {
  series: HecomClienteDashboard["summary"]["dailySeries"];
  gastoHoy: number;
  gasto7d: number;
  gasto30d: number;
  source: HecomClienteDashboard["summary"]["dailySource"];
}) {
  const max = Math.max(...series.map((p) => p.spend), 0);
  const peak = max > 0 ? max : 1;
  const hasAny = series.some((p) => p.spend > 0);
  // Móvil: últimos 7 días para no aplastar barras
  const mobileSeries = series.slice(-7);

  return (
    <section className="dashboard-surface-card overflow-hidden rounded-[1.05rem]">
      <div className="flex flex-col gap-3 border-b border-[var(--auth-divider)] px-4 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Gasto diario
            </h2>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                source === "none"
                  ? "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] ring-1 ring-[var(--auth-divider)]"
                  : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
              }`}
            >
              {dailySourceLabel(source)}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium text-[var(--auth-text-muted)]">
            <span className="sm:hidden">Últimos 7 días</span>
            <span className="hidden sm:inline">
              Últimos {series.length} días
            </span>{" "}
            · America/Lima
          </p>
        </div>
        <div className="flex gap-4 text-left sm:text-right">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
              Hoy
            </p>
            <p className="mt-0.5 text-[14px] font-bold tabular-nums text-[var(--auth-accent)]">
              {moneyUsd(gastoHoy)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
              7d
            </p>
            <p className="mt-0.5 text-[14px] font-bold tabular-nums text-[var(--auth-text)]">
              {moneyUsd(gasto7d)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
              30d
            </p>
            <p className="mt-0.5 text-[14px] font-bold tabular-nums text-[var(--auth-text)]">
              {moneyUsd(gasto30d)}
            </p>
          </div>
        </div>
      </div>

      {!hasAny ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5 sm:py-10">
          Aún no hay gasto diario registrado para este cliente. Cuando la sync
          TikTok escriba snapshots (o haya filas de gasto con fecha), se verán
          aquí.
        </p>
      ) : (
        <>
          {/* Mobile: 7 días legibles */}
          <div className="px-3 pb-4 pt-4 sm:hidden">
            <div className="flex h-36 items-end gap-2">
              {mobileSeries.map((point, index) => {
                const barPx =
                  point.spend > 0
                    ? Math.max(10, Math.round((point.spend / peak) * 108))
                    : 4;
                const isToday = index === mobileSeries.length - 1;
                return (
                  <div
                    key={point.date}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${shortDayLabel(point.date)}: ${moneyUsd(point.spend)}`}
                  >
                    <span className="max-w-full truncate text-[9px] font-semibold tabular-nums text-[var(--auth-text-soft)]">
                      {point.spend > 0
                        ? moneyUsd(point.spend).replace(/^\$/, "")
                        : "\u00a0"}
                    </span>
                    <div
                      className={`w-full max-w-[2.5rem] rounded-t-md ${
                        isToday
                          ? "bg-[var(--auth-accent)]"
                          : point.spend > 0
                            ? "bg-[var(--auth-accent)]/55"
                            : "bg-[var(--auth-divider)]"
                      }`}
                      style={{ height: barPx }}
                    />
                    <span
                      className={`text-[9px] font-semibold tabular-nums ${
                        isToday
                          ? "text-[var(--auth-accent)]"
                          : "text-[var(--auth-text-soft)]"
                      }`}
                    >
                      {shortDayLabel(point.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop / tablet: serie completa */}
          <div className="hidden px-4 pb-4 pt-5 sm:block sm:px-5">
            <div className="flex h-40 items-end gap-1.5 sm:gap-2">
              {series.map((point, index) => {
                const barPx =
                  point.spend > 0
                    ? Math.max(8, Math.round((point.spend / peak) * 112))
                    : 4;
                const isToday = index === series.length - 1;
                return (
                  <div
                    key={point.date}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${shortDayLabel(point.date)}: ${moneyUsd(point.spend)}`}
                  >
                    <span className="max-w-full truncate text-[9px] font-semibold tabular-nums text-[var(--auth-text-soft)] sm:text-[10px]">
                      {point.spend > 0
                        ? moneyUsd(point.spend).replace(/^\$/, "")
                        : "\u00a0"}
                    </span>
                    <div
                      className={`w-full max-w-[2.25rem] rounded-t-md ${
                        isToday
                          ? "bg-[var(--auth-accent)]"
                          : point.spend > 0
                            ? "bg-[var(--auth-accent)]/55"
                            : "bg-[var(--auth-divider)]"
                      }`}
                      style={{ height: barPx }}
                    />
                    <span
                      className={`text-[9px] font-semibold tabular-nums sm:text-[10px] ${
                        isToday
                          ? "text-[var(--auth-accent)]"
                          : "text-[var(--auth-text-soft)]"
                      }`}
                    >
                      {shortDayLabel(point.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({
  label,
  value,
  accent = false,
  hint,
  className = "",
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`dashboard-kpi rounded-[1rem] px-3.5 py-3 sm:px-4 sm:py-3.5 ${className}`}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)] sm:text-[0.68rem]">
        {label}
      </p>
      <p
        className={`mt-1.5 text-[1.15rem] font-bold tracking-[-0.03em] tabular-nums sm:text-[1.35rem] ${
          accent ? "text-[var(--auth-accent)]" : "text-[var(--auth-text)]"
        }`}
      >
        <span className="block truncate">{value}</span>
      </p>
      {hint ? (
        <p className="mt-1 truncate text-[11px] font-medium text-[var(--auth-text-soft)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SummaryChip({
  icon,
  label,
  value,
  hint,
  accent = false,
  warn = false,
}: {
  icon: "wallet" | "trend" | "clock" | "pause";
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="dashboard-kpi flex items-start gap-3 rounded-[1rem] px-3.5 py-3.5">
      <span
        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          warn
            ? "bg-amber-50 text-amber-700"
            : accent
              ? "bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]"
              : "bg-[var(--auth-bg)] text-[var(--auth-text-muted)]"
        }`}
        aria-hidden
      >
        <ChipIcon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
          {label}
        </p>
        <p
          className={`mt-0.5 truncate text-[1.05rem] font-bold tabular-nums tracking-[-0.02em] ${
            warn
              ? "text-[#b45309]"
              : accent
                ? "text-[var(--auth-accent)]"
                : "text-[var(--auth-text)]"
          }`}
        >
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--auth-text-soft)]">
          {hint}
        </p>
      </div>
    </div>
  );
}

function ChipIcon({ name }: { name: "wallet" | "trend" | "clock" | "pause" }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
  } as const;
  switch (name) {
    case "wallet":
      return (
        <svg {...common}>
          <path d="M3 8.5h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10Z" />
          <path d="M3 8.5 5.2 4.8A2 2 0 0 1 7 4h10a2 2 0 0 1 1.8.8L21 8.5" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="M4 17 10 11l4 4 6-8" />
          <path d="M14 7h6v6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 1.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M8 6v12M16 6v12" strokeLinecap="round" />
        </svg>
      );
  }
}

function ActionTile({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1rem] border border-[var(--auth-border)] bg-white p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--auth-accent)]/40 active:scale-[0.99]"
    >
      <p className="text-[14px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
        {title}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-[var(--auth-text-muted)]">
        {body}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--auth-accent)]">
        Abrir
        <svg
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
          />
        </svg>
      </span>
    </Link>
  );
}

function statusMeta(syncEnabled: boolean | undefined) {
  if (syncEnabled === false) {
    return {
      label: "Pausada",
      className:
        "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] ring-1 ring-[var(--auth-divider)]",
      dot: "bg-[var(--auth-text-soft)]",
    };
  }
  return {
    label: "En campaña",
    className: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80",
    dot: "bg-emerald-500",
  };
}

function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1.05rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Cuentas TikTok
            </h2>
            <span className="rounded-md bg-[var(--auth-bg)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--auth-text-muted)]">
              {accounts.length}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium text-[var(--auth-text-muted)]">
            Hecom · solo lectura
          </p>
        </div>
        <Link
          href={routes.adAccounts}
          className="shrink-0 text-[12px] font-bold text-[var(--auth-accent)] hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {accounts.length === 0 ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5 sm:py-10">
          Sin advertiser mapeado en Hecom.
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto sm:max-h-[24rem]">
          {accounts.map((account) => {
            const label = parseAdvertiserLabel(account.advertiserName);
            const status = statusMeta(account.syncEnabled);
            return (
              <li
                key={account.advertiserId}
                className="border-b border-[var(--auth-divider)] px-4 py-3.5 last:border-0 hover:bg-[var(--auth-bg)] sm:px-5"
              >
                {/* Mobile card row */}
                <div className="flex gap-3 sm:hidden">
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent-soft)] text-[11px] font-bold text-[var(--auth-accent)]"
                    aria-hidden
                  >
                    {initials(label.title)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-[var(--auth-text)]">
                        {label.title}
                      </p>
                      {label.balance ? (
                        <p className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--auth-accent)]">
                          {label.balance}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                        />
                        {status.label}
                      </span>
                      {account.bmBucket ? (
                        <span className="rounded-full bg-[var(--auth-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                          {account.bmBucket}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden items-center gap-3 sm:flex">
                  <span
                    aria-hidden
                    className={`h-8 w-[3px] shrink-0 rounded-full ${
                      account.syncEnabled !== false
                        ? "bg-emerald-500"
                        : "bg-[var(--auth-text-soft)]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                      {label.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--auth-text-muted)]">
                        {shortId(account.advertiserId)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                        />
                        {status.label}
                      </span>
                      {account.bmBucket ? (
                        <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                          BM {account.bmBucket}
                        </span>
                      ) : null}
                      {account.fee != null ? (
                        <span className="rounded bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--auth-accent)]">
                          Fee {account.fee}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {label.balance ? (
                    <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--auth-accent)]">
                      {label.balance}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GastosPanel({
  gastos,
  source,
}: {
  gastos: HecomGastoRow[];
  source: HecomClienteDashboard["source"];
}) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1.05rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Últimos gastos
            </h2>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                source === "hecom_live"
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
                  : "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] ring-1 ring-[var(--auth-divider)]"
              }`}
            >
              {sourceLabel(source)}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium text-[var(--auth-text-muted)]">
            Consumo reciente de campañas
          </p>
        </div>
        <Link
          href={routes.payments}
          className="shrink-0 text-[12px] font-bold text-[var(--auth-accent)] hover:underline"
        >
          Ver pagos
        </Link>
      </div>

      {gastos.length === 0 ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5 sm:py-10">
          Sin gastos registrados para este cliente.
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto sm:max-h-[24rem]">
          {gastos.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const label = formatHecomGastoDisplay(row.camp, {
              notas: row.notas,
              fee: row.fee,
              fecha: null,
            });
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-4 py-3.5 last:border-0 hover:bg-[var(--auth-bg)] sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--auth-text)] sm:text-[13.5px]">
                    {label.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {fecha ? (
                      <span className="rounded-full bg-[var(--auth-bg)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.fee != null ? (
                      <span className="rounded-full bg-[var(--auth-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--auth-accent)]">
                        Fee {row.fee}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 pt-0.5 text-[13px] font-bold tabular-nums text-[var(--auth-text)]">
                  {moneyUsd(row.gasto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
