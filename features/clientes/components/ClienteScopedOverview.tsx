import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { routes } from "@/config/routes";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
  resolveBmForGasto,
} from "@/lib/hecom/gasto-label";
import { formatBmBucketLabel } from "@/lib/hecom/bm-bucket.shared";
import {
  getHecomCampaignSpendRows,
  type HecomClienteDashboard,
  type HecomGastoRow,
} from "@/lib/hecom/cliente-dashboard.server";
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";
import type { HecomTiktokAccount } from "@/lib/hecom/clientes.server";

/*
 * Resumen del cliente con el mismo lenguaje visual de «Lo pagado» (links deuda):
 * tarjeta oscura con la cifra principal, tarjetas blancas con borde cálido y
 * listas ordenadas. No mostramos «Deuda neta» Hecom aquí: suele estar
 * incompleta (cobros faltantes) y asusta al cliente.
 */

const CARD = "rounded-[22px] bg-white ring-1 ring-[#e8dfd4]";
const INK = "text-[#1a1714]";
const SOFT = "text-[#5c564e]";
const MUTED = "text-[#8a8177]";

/** «Jesus Fuentes 201.0 USD - Agencia» → nombre + número de cuenta (no es saldo). */
function parseAdvertiserLabel(raw: string | null) {
  if (!raw?.trim()) return { title: "TikTok Ads", code: null as string | null };
  const match = raw.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(?:USD)?\s*(?:[-–]\s*.+)?$/i);
  if (match && match[1].trim()) return { title: match[1].trim(), code: match[2].replace(/\.0+$/, "") };
  return { title: raw.trim(), code: null };
}

function shortId(id: string) {
  return id.length <= 10 ? id : `…${id.slice(-6)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function shortDayLabel(dateYmd: string) {
  const iso = dateYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateYmd;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export async function ClienteScopedOverview({
  data,
  canChangeCliente = false,
  accountSpend,
}: {
  data: HecomClienteDashboard;
  canChangeCliente?: boolean;
  /** Gasto por cuenta. Si viene de fuera, el overview no espera las filas de campaña. */
  accountSpend?: ReactNode;
}) {
  const t = await getTranslations("overview");
  const { formatMoney } = await getAppFormatter();
  const moneyUsd = (value: number) => formatMoney(value, "USD");
  const { cliente, summary, accounts, gastos } = data;
  const recentGastos = gastos.slice(0, 8);
  const activeAccounts = accounts.filter((a) => a.syncEnabled !== false).length;
  const pausedAccounts = Math.max(0, accounts.length - activeAccounts);
  const share7d = summary.gasto30d > 0.004 ? Math.min(1, summary.gasto7d / summary.gasto30d) : 0;
  const todayHint =
    summary.dailySource === "none"
      ? t("noDaySync")
      : summary.gastoHoy > 0
        ? t("timezoneLima")
        : t("noActivityToday");

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Cabecera: quién es y qué puede hacer */}
      <header className={`${CARD} flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5`}>
        <div className="flex min-w-0 items-center gap-3">
          {cliente.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cliente.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#e8dfd4]" />
          ) : (
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fbeee3] text-[14px] font-bold text-[#b85f2e]" aria-hidden>
              {initials(cliente.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">{t("module")}</p>
            <h1 className={`truncate text-[1.35rem] font-semibold tracking-[-0.03em] ${INK}`}>{cliente.name}</h1>
            <p className={`text-[12px] ${SOFT}`}>{t("feeMeta", { percent: summary.depositFeePercent })}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.payments}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#c46d3c] px-4 text-[13px] font-semibold text-white transition hover:bg-[#b0602f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a074]"
          >
            <WalletIcon />
            {canChangeCliente ? t("ctaReloadAssign") : t("ctaReload")}
          </Link>
          <Link
            href={routes.adAccounts}
            className={`inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold ring-1 ring-[#e8dfd4] transition hover:bg-[#faf8f5] ${INK}`}
          >
            <ChartIcon />
            {t("ctaAccounts")}
          </Link>
          {canChangeCliente ? (
            <Link href={routes.clientes} className={`px-2 text-[13px] font-semibold underline-offset-4 hover:underline ${SOFT}`}>
              {t("changeClient")}
            </Link>
          ) : null}
        </div>
      </header>

      {/* Cifra principal + KPIs */}
      <section className="rounded-[24px] bg-[#faf8f5] p-3 ring-1 ring-[#e8dfd4] sm:p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="relative col-span-2 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#fffaf5] to-[#fbefe4] px-5 py-5 ring-1 ring-[#f0e0d1] sm:px-6 sm:py-6">
            <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-[#f3c9a8]/30 blur-2xl" aria-hidden />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#9a5a32] ring-1 ring-[#f0e0d1]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e2a074]" aria-hidden />
                {t("hero.badge")}
              </span>
              <p className={`mt-3 text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.045em] min-[400px]:text-[2.4rem] sm:text-[2.75rem] ${INK}`}>
                {moneyUsd(summary.gasto30d)}
              </p>
              <p className={`mt-2 text-[12px] ${SOFT}`}>{t("hero.caption")}</p>
              <div className="mt-5">
                <div className={`flex items-center justify-between text-[11px] ${SOFT}`}>
                  <span>
                    {t("spend7d")} {moneyUsd(summary.gasto7d)}
                  </span>
                  <span className="tabular-nums">{Math.round(share7d * 100)}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f1e4d8]">
                  <div className="h-full rounded-full bg-[#e2a074]" style={{ width: `${share7d * 100}%` }} />
                </div>
                <p className={`mt-2 text-[11px] leading-4 ${MUTED}`}>
                  {t("spendToday")}: {moneyUsd(summary.gastoHoy)} · {todayHint}
                </p>
              </div>
            </div>
          </div>

          <Kpi label={t("cobros")} value={moneyUsd(summary.cobroTotal)} tone="paid" hint={t("hero.cobrosHint")} className="col-span-1" />
          <Kpi label={t("adSpend")} value={moneyUsd(summary.gastoTotal)} hint={t("hero.adSpendHint")} className="col-span-1" />
          <Kpi
            label={t("tiktokAccounts")}
            value={String(summary.accountCount)}
            hint={summary.accountCount > 0 ? t("accountsHint", { active: activeAccounts, paused: pausedAccounts }) : undefined}
            footer={t("feeMeta", { percent: summary.depositFeePercent })}
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </section>

      {accountSpend ?? (
        <AccountSpendPanel
          rows={data.campaignSpendRows}
          accounts={accounts}
          anchorDate={summary.dailyAnchorDate}
          moneyUsd={moneyUsd}
        />
      )}

      <DailySpendPanel
        series={summary.dailySeries}
        gastoHoy={summary.gastoHoy}
        gasto7d={summary.gasto7d}
        gasto30d={summary.gasto30d}
        source={summary.dailySource}
        moneyUsd={moneyUsd}
      />

      {/* Accesos */}
      <nav className="flex flex-wrap items-center gap-2" aria-label={t("hero.quickLinks")}>
        {[
          { href: routes.adAccounts, label: t("quickAdAccounts") },
          { href: routes.payments, label: t("quickPayments") },
          { href: routes.profit, label: t("quickProfit") },
          { href: `${routes.payments}#asignar-saldo`, label: t("quickAssign") },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12.5px] font-semibold ring-1 ring-[#e8dfd4] transition hover:bg-[#faf8f5] hover:ring-[#d9c9b8] ${INK}`}
          >
            {link.label}
            <span aria-hidden className="text-[#e2a074]">→</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 xl:grid-cols-2">
        <AccountsPanel accounts={accounts} />
        <GastosPanel gastos={recentGastos} accounts={accounts} source={data.source} moneyUsd={moneyUsd} />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  footer,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  footer?: string;
  tone?: "neutral" | "paid";
  className?: string;
}) {
  return (
    <div className={`${CARD} flex flex-col px-4 py-4 sm:px-5 ${className}`}>
      <p className={`text-[12px] font-medium ${SOFT}`}>{label}</p>
      <p className={`mt-1 text-[1.45rem] font-semibold tabular-nums tracking-[-0.03em] ${tone === "paid" ? "text-[#2f7a4a]" : INK}`}>
        {value}
      </p>
      {hint ? <p className={`mt-1 text-[11.5px] leading-4 ${MUTED}`}>{hint}</p> : null}
      {footer ? (
        <p className="mt-auto pt-3">
          <span className="inline-flex rounded-full bg-[#fbeee3] px-2 py-0.5 text-[11px] font-semibold text-[#b85f2e]">{footer}</span>
        </p>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  count,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD} flex flex-col overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className={`text-[15px] font-semibold tracking-[-0.02em] ${INK}`}>{title}</h2>
          {subtitle ? <p className={`mt-0.5 text-[12px] ${SOFT}`}>{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {count != null ? (
            <span className={`rounded-full bg-[#f3eee8] px-2 py-0.5 text-[11px] font-semibold tabular-nums ${SOFT}`}>{count}</span>
          ) : null}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

async function DailySpendPanel({
  series,
  gastoHoy,
  gasto7d,
  gasto30d,
  source,
  moneyUsd,
}: {
  series: HecomClienteDashboard["summary"]["dailySeries"];
  gastoHoy: number;
  gasto7d: number;
  gasto30d: number;
  source: HecomClienteDashboard["summary"]["dailySource"];
  moneyUsd: (value: number) => string;
}) {
  const t = await getTranslations("overview");
  const max = Math.max(...series.map((p) => p.spend), 0);
  const peak = max > 0 ? max : 1;
  const hasAny = series.some((p) => p.spend > 0);
  const peakPoint = hasAny ? series.reduce((best, p) => (p.spend > best.spend ? p : best), series[0]) : null;
  const sourceLabel =
    source === "snapshots"
      ? t("dailySpend.sourceTiktok")
      : source === "gastos"
        ? t("dailySpend.sourceGastos")
        : t("dailySpend.sourceNone");
  const mobileSeries = series.slice(-7);

  const bars = (points: typeof series, height: number) => (
    <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: height + 34 }}>
      {points.map((point, index) => {
        const isToday = index === points.length - 1;
        const isPeak = peakPoint?.date === point.date;
        const barPx = point.spend > 0 ? Math.max(6, Math.round((point.spend / peak) * height)) : 3;
        return (
          <div
            key={point.date}
            className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${shortDayLabel(point.date)}: ${moneyUsd(point.spend)}`}
          >
            <span
              className={`max-w-full truncate text-[9.5px] font-semibold tabular-nums transition-opacity ${
                isPeak || isToday ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              } ${isPeak ? "text-[#b85f2e]" : MUTED}`}
            >
              {point.spend > 0 ? moneyUsd(point.spend) : " "}
            </span>
            <div
              className={`w-full max-w-[1.6rem] rounded-t-[5px] transition-colors ${
                isToday || isPeak ? "bg-[#e2a074]" : point.spend > 0 ? "bg-[#f3dccb] group-hover:bg-[#e2a074]" : "bg-[#f1ebe4]"
              }`}
              style={{ height: barPx }}
            />
            <span className={`text-[9.5px] font-semibold tabular-nums ${isToday ? "text-[#b85f2e]" : MUTED}`}>
              {shortDayLabel(point.date)}
            </span>
            {isToday ? <span className="h-0.5 w-3 rounded-full bg-[#e2a074]" aria-hidden /> : <span className="h-0.5" aria-hidden />}
          </div>
        );
      })}
    </div>
  );

  return (
    <Panel
      title={t("dailySpend.title")}
      subtitle={t("dailySpend.subtitle", { days: series.length })}
      action={
        <span className={`rounded-full bg-[#f3eee8] px-2.5 py-1 text-[11px] font-medium ${SOFT}`}>
          {t("dailySpend.source")} <span className={INK}>{sourceLabel}</span>
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2 px-4 sm:px-5">
        <DayMetric label={t("dailySpend.today")} value={moneyUsd(gastoHoy)} accent />
        <DayMetric label={t("spend7d")} value={moneyUsd(gasto7d)} />
        <DayMetric label={t("hero.last30")} value={moneyUsd(gasto30d)} />
      </div>
      {!hasAny ? (
        <p className={`px-4 py-10 text-center text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("dailySpend.empty")}</p>
      ) : (
        <>
          <div className="px-3 pb-2 pt-5 sm:hidden">{bars(mobileSeries, 110)}</div>
          <div className="hidden px-5 pb-2 pt-5 sm:block">{bars(series, 130)}</div>
          {peakPoint ? (
            <p className={`border-t border-[#efe8e0] px-4 py-3 text-[11.5px] sm:px-5 ${MUTED}`}>
              {t("hero.peakDay", { date: shortDayLabel(peakPoint.date), amount: moneyUsd(peakPoint.spend) })}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

export function OverviewAccountSpendFallback() {
  return (
    <section
      className={`${CARD} animate-pulse px-4 py-4 sm:px-5`}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-4 w-40 rounded-full bg-[#f3eee8]" />
      <div className="mt-1.5 h-3 w-64 max-w-full rounded-full bg-[#f7f2ec]" />
      <div className="mt-4 space-y-3 pb-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 rounded-xl bg-[#faf8f5]" />
        ))}
      </div>
    </section>
  );
}

/** Mismas filas que el overview completo, sin bloquear los KPIs. */
export async function OverviewAccountSpend({
  clienteId,
  accounts,
  gastos,
  anchorDate,
}: {
  clienteId: string;
  accounts: HecomClienteDashboard["accounts"];
  gastos: HecomClienteDashboard["gastos"];
  anchorDate: string;
}) {
  const { formatMoney } = await getAppFormatter();
  const moneyUsd = (value: number) => formatMoney(value, "USD");
  let rows: HecomClienteDashboard["campaignSpendRows"] = [];
  try {
    rows = await getHecomCampaignSpendRows({ clienteId, accounts, gastos });
  } catch (error) {
    console.error("[overview] campaign spend failed", {
      clienteId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return (
    <AccountSpendPanel
      rows={rows}
      accounts={accounts}
      anchorDate={anchorDate}
      moneyUsd={moneyUsd}
    />
  );
}

/** Gasto de cada cuenta en los últimos 30 días (snapshots TikTok o gastos Hecom). */
async function AccountSpendPanel({
  rows,
  accounts,
  anchorDate,
  moneyUsd,
}: {
  rows: HecomClienteDashboard["campaignSpendRows"];
  accounts: HecomTiktokAccount[];
  anchorDate: string;
  moneyUsd: (value: number) => string;
}) {
  const t = await getTranslations("overview");
  const end = anchorDate.slice(0, 10);
  const startMs = Date.parse(`${end}T00:00:00Z`) - 29 * 86_400_000;
  const start = Number.isFinite(startMs) ? new Date(startMs).toISOString().slice(0, 10) : "";
  const byAccount = new Map<string, number>();
  for (const row of rows) {
    if (!row.date || row.date < start || row.date > end) continue;
    const key = row.advertiserId ?? "otros";
    byAccount.set(key, (byAccount.get(key) ?? 0) + row.spend);
  }
  const accountById = new Map(accounts.map((a) => [a.advertiserId, a]));
  const items = [...byAccount.entries()]
    .map(([id, spend]) => {
      const account = accountById.get(id);
      const label = parseAdvertiserLabel(account?.advertiserName ?? null);
      return {
        id,
        spend: Math.round(spend * 100) / 100,
        name: account ? `${label.title}${label.code ? ` · ${label.code}` : ""}` : id === "otros" ? t("byAccount.unknown") : `${t("byAccount.account")} ${shortId(id)}`,
        meta: [account?.bmBucket ? `BM ${account.bmBucket}` : null, id !== "otros" ? `ID ${shortId(id)}` : null].filter(Boolean).join(" · "),
      };
    })
    .filter((item) => item.spend > 0.004)
    .sort((a, b) => b.spend - a.spend);
  const total = items.reduce((sum, item) => sum + item.spend, 0);
  const TOP = 6;
  const rest = items.slice(TOP);
  const shown =
    rest.length > 1
      ? [
          ...items.slice(0, TOP),
          {
            id: "resto",
            name: t("byAccount.others", { count: rest.length }),
            meta: "",
            spend: Math.round(rest.reduce((sum, item) => sum + item.spend, 0) * 100) / 100,
          },
        ]
      : items;

  return (
    <Panel
      title={t("byAccount.title")}
      subtitle={t("byAccount.subtitle")}
      action={
        <span className={`rounded-full bg-[#f3eee8] px-2.5 py-1 text-[11px] font-semibold ${SOFT}`}>
          {t("byAccount.count", { count: items.length })}
        </span>
      }
    >
      {items.length === 0 ? (
        <p className={`px-4 pb-8 pt-2 text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("byAccount.empty")}</p>
      ) : (
        <div className="px-4 pb-4 sm:px-5">
          <ul>
            {shown.map((item) => {
              const share = total > 0 ? item.spend / total : 0;
              return (
                <li key={item.id} className="border-t border-[#f1ebe4] py-3 first:border-t-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-[13.5px] font-semibold ${INK}`}>{item.name}</p>
                      {item.meta ? <p className={`mt-0.5 truncate text-[11.5px] ${MUTED}`}>{item.meta}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[13.5px] font-semibold tabular-nums ${INK}`}>{moneyUsd(item.spend)}</p>
                      <p className={`text-[11px] tabular-nums ${MUTED}`}>{Math.round(share * 100)}%</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f3ece5]">
                    <div className="h-full rounded-full bg-[#e2a074]" style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-[#efe8e0] pt-3">
            <span className={`text-[12.5px] font-semibold ${SOFT}`}>{t("byAccount.total")}</span>
            <span className={`text-[14px] font-semibold tabular-nums ${INK}`}>{moneyUsd(total)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function DayMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[14px] bg-[#faf8f5] px-3 py-2.5">
      <p className={`flex items-center gap-1.5 text-[11px] font-medium ${SOFT}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${accent ? "bg-[#e2a074]" : "bg-[#d9cfc4]"}`} aria-hidden />
        {label}
      </p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums tracking-[-0.02em] sm:text-[17px] ${INK}`}>{value}</p>
    </div>
  );
}

async function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  const t = await getTranslations("overview");

  return (
    <Panel
      title={t("tiktokAccounts")}
      subtitle={t("accountsPanel.hecomReadonly")}
      action={
        <Link href={routes.adAccounts} className={`text-[12px] font-semibold underline-offset-4 hover:underline ${INK}`}>
          {t("accountsPanel.viewAll", { count: accounts.length })}
        </Link>
      }
      className="h-full"
    >
      {accounts.length === 0 ? (
        <p className={`px-4 pb-8 pt-4 text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("accountsPanel.empty")}</p>
      ) : (
        <ul className="max-h-[26rem] flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
          {accounts.map((account) => {
            const label = parseAdvertiserLabel(account.advertiserName);
            const active = account.syncEnabled !== false;
            return (
              <li key={account.advertiserId} className="flex items-center gap-3 border-t border-[#f1ebe4] py-3 first:border-t-0">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[11px] font-bold ${
                    active ? "bg-[#eaf5ee] text-[#2f7a4a]" : "bg-[#f3eee8] text-[#8a8177]"
                  }`}
                  aria-hidden
                >
                  {label.code ?? initials(label.title)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13.5px] font-semibold ${INK}`}>
                    {label.title}
                    {label.code ? <span className={`font-medium ${MUTED}`}> · {label.code}</span> : null}
                  </p>
                  <p className={`mt-0.5 truncate text-[11.5px] ${MUTED}`}>
                    {[account.bmBucket ? `BM ${account.bmBucket}` : null, `ID ${shortId(account.advertiserId)}`, account.fee != null ? `Fee ${account.fee}%` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    active ? "bg-[#eaf5ee] text-[#2f7a4a]" : "bg-[#f3eee8] text-[#8a8177]"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#3f9a62]" : "bg-[#b5aaa0]"}`} aria-hidden />
                  {active ? t("accountsPanel.inCampaign") : t("accountsPanel.paused")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function bmMapFromAccounts(accounts: HecomTiktokAccount[]) {
  const map = new Map<string, string | null>();
  for (const account of accounts) map.set(account.advertiserId, formatBmBucketLabel(account.bmBucket));
  return map;
}

async function GastosPanel({
  gastos,
  accounts,
  source,
  moneyUsd,
}: {
  gastos: HecomGastoRow[];
  accounts: HecomTiktokAccount[];
  source: HecomClienteDashboard["source"];
  moneyUsd: (value: number) => string;
}) {
  const t = await getTranslations("overview");
  const bmByAdvertiser = bmMapFromAccounts(accounts);
  const live = source === "hecom_live";

  return (
    <Panel
      title={t("gastosPanel.title")}
      subtitle={t("gastosPanel.subtitle")}
      action={
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${SOFT}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[#3f9a62]" : "bg-[#b5aaa0]"}`} aria-hidden />
            {live ? t("live") : t("backup")}
          </span>
          <Link href={routes.profit} className={`text-[12px] font-semibold underline-offset-4 hover:underline ${INK}`}>
            {t("gastosPanel.viewProfit")}
          </Link>
        </div>
      }
      className="h-full"
    >
      {gastos.length === 0 ? (
        <p className={`px-4 pb-8 pt-4 text-[13px] font-medium sm:px-5 ${SOFT}`}>{t("gastosPanel.empty")}</p>
      ) : (
        <ul className="max-h-[26rem] flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
          {gastos.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const bm = resolveBmForGasto(row, bmByAdvertiser);
            const label = formatHecomGastoDisplay(row.camp, { notas: row.notas, fee: row.fee, fecha: null });
            return (
              <li key={row.id} className="flex items-center gap-3 border-t border-[#f1ebe4] py-3 first:border-t-0">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#fbeee3] text-[#e2a074]" aria-hidden>
                  <TrendIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13.5px] font-semibold ${INK}`}>{label.title}</p>
                  <p className={`mt-0.5 truncate text-[11.5px] ${MUTED}`}>
                    {[fecha, bm, row.fee != null ? `Fee ${row.fee}%` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className={`shrink-0 text-[13.5px] font-semibold tabular-nums ${INK}`}>{moneyUsd(row.gasto)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function WalletIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 8.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 8.5 6 5.2A1.8 1.8 0 0 1 7.6 4.5h8.8A1.8 1.8 0 0 1 18 5.2L20 8.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="13.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 15v-3M12 15V8M16 15v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4 16 5-5 4 4 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 8h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
