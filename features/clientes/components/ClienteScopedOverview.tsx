import Link from "next/link";
import { routes } from "@/config/routes";
import {
  CrmHeroButton,
  CrmMetricCell,
  CrmMetricsStrip,
  CrmPanel,
  CrmQuickLinks,
  CrmScopeHero,
} from "@/components/dashboard/crm-ui";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
  resolveBmForGasto,
} from "@/lib/hecom/gasto-label";
import { formatBmBucketLabel } from "@/lib/hecom/bm-bucket.shared";
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
 * Overview del cliente — consola operativa Ads Holistic.
 * No mostramos “Deuda neta” Hecom aquí: suele estar incompleta (cobros faltantes)
 * y asusta al cliente. Staff ve cobros/gastos en el strip de métricas.
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
  const activeAccounts = accounts.filter((a) => a.syncEnabled !== false).length;
  const pausedAccounts = Math.max(0, accounts.length - activeAccounts);

  return (
    <div className="space-y-5 sm:space-y-6">
      <CrmScopeHero
        module="Hecom Club"
        title={cliente.name}
        cliente={{ name: cliente.name, avatarUrl: cliente.avatarUrl, biz: cliente.biz }}
        meta={`Fee Holistic ${summary.depositFeePercent}%`}
        actions={
          <>
            <CrmHeroButton href={routes.payments}>
              <WalletIcon />
              {canChangeCliente ? "Recargar / asignar" : "Recargar"}
            </CrmHeroButton>
            <CrmHeroButton href={routes.adAccounts} variant="secondary">
              <ChartIcon />
              Ver cuentas
            </CrmHeroButton>
            {canChangeCliente ? (
              <CrmHeroButton href={routes.clientes} variant="ghost">
                Cambiar cliente
              </CrmHeroButton>
            ) : null}
          </>
        }
        aside={
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
              Gasto de hoy
            </p>
            <p className="mt-1 text-[1.65rem] font-bold tracking-[-0.03em] tabular-nums text-[var(--auth-text)] sm:text-[1.85rem]">
              {moneyUsd(summary.gastoHoy)}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--auth-text-muted)]">
              Últimos 7 días · {moneyUsd(summary.gasto7d)} · Fee{" "}
              {summary.depositFeePercent}%
            </p>
          </div>
        }
      />

      {/* Métricas — una sola superficie */}
      <OverviewMetricsStrip
        summary={summary}
        activeAccounts={activeAccounts}
        pausedAccounts={pausedAccounts}
        accountCount={summary.accountCount}
        dailySource={summary.dailySource}
      />

      <DailySpendPanel
        series={summary.dailySeries}
        gastoHoy={summary.gastoHoy}
        gasto7d={summary.gasto7d}
        gasto30d={summary.gasto30d}
        source={summary.dailySource}
      />

      <CrmQuickLinks
        links={[
          { href: routes.adAccounts, label: "Cuentas ads" },
          { href: routes.payments, label: "Pagos" },
          { href: routes.gastos, label: "Gastos" },
          { href: `${routes.payments}#asignar-saldo`, label: "Asignar saldo" },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <AccountsPanel accounts={accounts} />
        <GastosPanel gastos={recentGastos} accounts={accounts} source={data.source} />
      </div>
    </div>
  );
}

function OverviewMetricsStrip({
  summary,
  activeAccounts,
  pausedAccounts,
  accountCount,
  dailySource,
}: {
  summary: HecomClienteDashboard["summary"];
  activeAccounts: number;
  pausedAccounts: number;
  accountCount: number;
  dailySource: HecomClienteDashboard["summary"]["dailySource"];
}) {
  const gastoHoyHint =
    dailySource === "none"
      ? "Sin sync del día"
      : summary.gastoHoy > 0
        ? "America/Lima"
        : "Sin actividad hoy";
  const accountsHint =
    accountCount > 0 ? `${activeAccounts} activas · ${pausedAccounts} pausadas` : undefined;

  return (
    <CrmMetricsStrip>
      <div className="border-b border-[var(--auth-divider)] sm:hidden">
        <CrmMetricCell
          label="Gasto de hoy"
          value={moneyUsd(summary.gastoHoy)}
          hint={gastoHoyHint}
          emphasis="primary"
        />
      </div>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:divide-x sm:divide-[var(--auth-divider)]">
        <CrmMetricCell
          className="hidden sm:block"
          label="Gasto de hoy"
          value={moneyUsd(summary.gastoHoy)}
          hint={gastoHoyHint}
          emphasis="primary"
        />
        <CrmMetricCell
          className="border-r border-[var(--auth-divider)] sm:border-r-0"
          label="Últimos 7 días"
          value={moneyUsd(summary.gasto7d)}
        />
        <CrmMetricCell
          className="border-b border-[var(--auth-divider)] sm:border-b-0"
          label="Cobros"
          value={moneyUsd(summary.cobroTotal)}
        />
        <CrmMetricCell label="Gastos ads" value={moneyUsd(summary.gastoTotal)} />
        <CrmMetricCell
          className="border-r border-[var(--auth-divider)] sm:border-r-0"
          label="Fee Holistic"
          value={`${summary.depositFeePercent}%`}
          emphasis="muted"
        />
        <CrmMetricCell
          label="Cuentas TikTok"
          value={String(accountCount)}
          hint={accountsHint}
          emphasis="muted"
        />
      </div>
    </CrmMetricsStrip>
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
    <CrmPanel
      title="Gasto diario"
      subtitle={`Últimos ${series.length} días · America/Lima`}
      className="shadow-none"
      action={
        <div className="flex items-center gap-4 text-left sm:text-right">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
              Hoy
            </p>
            <p className="mt-0.5 text-[15px] font-bold tabular-nums text-[var(--auth-text)]">
              {moneyUsd(gastoHoy)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
              7d
            </p>
            <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--auth-text)]">
              {moneyUsd(gasto7d)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
              30d
            </p>
            <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--auth-text)]">
              {moneyUsd(gasto30d)}
            </p>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--auth-divider)] px-4 pb-3 pt-0.5">
        <span className="text-[11px] font-medium text-[var(--auth-text-muted)]">
          Fuente:{" "}
          <span
            className={
              source === "none"
                ? "text-[var(--auth-text-soft)]"
                : "text-[var(--auth-text)]"
            }
          >
            {dailySourceLabel(source)}
          </span>
        </span>
      </div>

      {!hasAny ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:py-10">
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
    </CrmPanel>
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
    <CrmPanel
      title="Cuentas TikTok"
      subtitle="Hecom · solo lectura"
      className="flex h-full flex-col overflow-hidden"
      action={
        <Link
          href={routes.adAccounts}
          className="shrink-0 text-[12px] font-semibold text-[var(--auth-text)] hover:underline"
        >
          Ver todas ({accounts.length})
        </Link>
      }
    >
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
    </CrmPanel>
  );
}

function bmMapFromAccounts(accounts: HecomTiktokAccount[]) {
  const map = new Map<string, string | null>();
  for (const account of accounts) {
    map.set(account.advertiserId, formatBmBucketLabel(account.bmBucket));
  }
  return map;
}

function GastosPanel({
  gastos,
  accounts,
  source,
}: {
  gastos: HecomGastoRow[];
  accounts: HecomTiktokAccount[];
  source: HecomClienteDashboard["source"];
}) {
  const bmByAdvertiser = bmMapFromAccounts(accounts);

  return (
    <CrmPanel
      title="Últimos gastos"
      subtitle="Consumo reciente de campañas"
      action={
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-[var(--auth-text-muted)]">
            {sourceLabel(source)}
          </span>
          <Link
            href={routes.gastos}
            className="shrink-0 text-[12px] font-semibold text-[var(--auth-text)] hover:underline"
          >
            Ver gastos
          </Link>
        </div>
      }
      className="flex h-full flex-col overflow-hidden"
    >
      {gastos.length === 0 ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5 sm:py-10">
          Sin gastos registrados para este cliente.
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto sm:max-h-[24rem]">
          {gastos.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const bm = resolveBmForGasto(row, bmByAdvertiser);
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
                    {bm ? (
                      <span className="rounded-full bg-[var(--auth-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--auth-text)]">
                        {bm}
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
    </CrmPanel>
  );
}
