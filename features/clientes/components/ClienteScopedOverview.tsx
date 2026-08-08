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

/**
 * Overview del cliente seleccionado — layout claro corporativo Holistic.
 */
export function ClienteScopedOverview({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, accounts, gastos } = data;
  const recentGastos = gastos.slice(0, 8);
  const debt = summary.saldoEstimado < 0;

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Header compacto */}
      <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="lg"
                className="ring-2 ring-white"
              />
              <div className="min-w-0">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
                  Resumen
                </p>
                {cliente.biz ? (
                  <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-soft)]">
                    {cliente.biz}
                  </p>
                ) : null}
              </div>
            </div>

            <OverviewClientTitle name={cliente.name} />

            <p className="mt-2 max-w-xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
              Cuentas TikTok, cobros Hecom y gasto ads del cliente activo.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href={routes.adAccounts}
                className="inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
              >
                Ver cuentas
              </Link>
              <Link
                href={routes.payments}
                className="inline-flex h-10 items-center rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)]"
              >
                Ir a pagos
              </Link>
              <Link
                href={routes.clientes}
                className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
              >
                Cambiar cliente
              </Link>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[1rem] border border-[var(--auth-border)] bg-[var(--auth-bg)] p-5 lg:min-w-[260px]">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
              {debt ? "Deuda neta" : "Saldo estimado"}
            </p>
            <p
              className={`mt-2 text-[2rem] font-bold leading-none tracking-[-0.04em] tabular-nums ${
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
              El fondeo BM no baja esta deuda: solo un cobro Hecom.
            </p>
          </div>
        </div>
      </section>

      {/* KPIs claros */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cuentas TikTok" value={String(summary.accountCount)} />
        <Kpi label="Cobros" value={moneyUsd(summary.cobroTotal)} accent />
        <Kpi label="Gastos ads" value={moneyUsd(summary.gastoTotal)} />
        <Kpi label="Fees" value={moneyUsd(summary.feeTotal)} />
      </section>

      {/* Acciones rápidas */}
      <section>
        <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
          Accesos rápidos
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionTile
            href={routes.adAccounts}
            title="Cuentas ads"
            body="Advertisers TikTok mapeados."
          />
          <ActionTile
            href={routes.payments}
            title="Pagos"
            body="Recarga o fondeo BM."
          />
          <ActionTile
            href={`${routes.payments}#asignar-saldo`}
            title="Asignar saldo"
            body="Presupuesto hacia ads."
          />
        </div>
      </section>

      {/* Detalle */}
      <div className="grid gap-5 xl:grid-cols-2">
        <AccountsPanel accounts={accounts} />
        <GastosPanel gastos={recentGastos} source={data.source} />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="dashboard-kpi rounded-[1rem] px-4 py-3.5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
        {label}
      </p>
      <p
        className={`mt-1.5 truncate text-[1.25rem] font-bold tracking-[-0.03em] tabular-nums sm:text-[1.35rem] ${
          accent ? "text-[var(--auth-accent)]" : "text-[var(--auth-text)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
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
      className="group rounded-[1rem] border border-[var(--auth-border)] bg-white p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--auth-accent)]/40"
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

function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-4">
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
        <p className="px-5 py-10 text-[13px] font-medium text-[var(--auth-text-muted)]">
          Sin advertiser mapeado en Hecom.
        </p>
      ) : (
        <ul className="max-h-[24rem] flex-1 overflow-y-auto">
          {accounts.map((account) => {
            const label = parseAdvertiserLabel(account.advertiserName);
            return (
              <li
                key={account.advertiserId}
                className="flex items-center gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 last:border-0 hover:bg-[var(--auth-bg)]"
              >
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
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-4">
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
        <p className="px-5 py-10 text-[13px] font-medium text-[var(--auth-text-muted)]">
          Sin gastos registrados para este cliente.
        </p>
      ) : (
        <ul className="max-h-[24rem] flex-1 overflow-y-auto">
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
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 last:border-0 hover:bg-[var(--auth-bg)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                    {label.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.fee != null ? (
                      <span className="rounded bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--auth-accent)]">
                        Fee {row.fee}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--auth-text)]">
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
