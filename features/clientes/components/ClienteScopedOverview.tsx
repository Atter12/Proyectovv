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

/** Overview del cliente — tipografía/colores = landing Holistic. */
export function ClienteScopedOverview({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, accounts, gastos } = data;
  const recentGastos = gastos.slice(0, 8);

  return (
    <div className="space-y-8">
      <section className="dashboard-surface-card relative overflow-hidden rounded-[1.25rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#ff781f,#ffa12c)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[rgb(255_120_31_/_0.08)] blur-3xl"
        />

        <div className="relative grid gap-8 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)] lg:items-end lg:gap-10">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <HecomClienteAvatar
              name={cliente.name}
              avatarUrl={cliente.avatarUrl}
              size="lg"
              className="mt-0.5 ring-2 ring-white shadow-[0_10px_28px_rgb(15_23_42_/_0.1)]"
            />
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
                Cliente activo
              </p>
              <OverviewClientTitle name={cliente.name} />
              <p className="mt-1.5 max-w-md text-[13px] leading-5 text-[var(--auth-text-muted)]">
                Pulso del mes
                {cliente.biz ? (
                  <>
                    {" · "}
                    <span className="font-medium text-[var(--auth-text)]">
                      {cliente.biz}
                    </span>
                  </>
                ) : null}
                : cuentas, cobros, gastos y saldo.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={routes.adAccounts}
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--auth-accent)] px-3.5 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
                >
                  Sus cuentas
                </Link>
                <Link
                  href={routes.payments}
                  className="inline-flex h-9 items-center rounded-lg border border-[var(--auth-control-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
                >
                  Sus pagos
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--auth-divider)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
              {summary.saldoEstimado < 0 ? "Deuda neta" : "Saldo estimado"}
            </p>
            <p className="mt-1.5 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--auth-text)] sm:text-[1.95rem]">
              {moneyUsd(summary.saldoEstimado)}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--auth-text-muted)]">
              Cobros {moneyUsd(summary.cobroTotal)} − gastos{" "}
              {moneyUsd(summary.gastoTotal)} − fees{" "}
              {moneyUsd(summary.feeTotal)}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-[var(--auth-text-soft)]">
              No baja al fondear el BM: eso es presupuesto ads. La deuda baja
              solo con un cobro registrado en Hecom.
            </p>
          </div>
        </div>

        <div
          aria-label="Indicadores"
          className="grid grid-cols-2 border-t border-[var(--auth-divider)] bg-[var(--auth-bg)] sm:grid-cols-4"
        >
          <Metric
            label="Cuentas"
            value={String(summary.accountCount)}
            hint="TikTok"
          />
          <Metric
            label="Cobros"
            value={moneyUsd(summary.cobroTotal)}
            hint="Entradas"
            tone="text-emerald-700"
            border
          />
          <Metric
            label="Gastos ads"
            value={moneyUsd(summary.gastoTotal)}
            hint="Consumo"
            border
          />
          <Metric
            label="Fees"
            value={moneyUsd(summary.feeTotal)}
            hint="Servicio"
            border
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <AccountsPanel accounts={accounts} />
        <GastosPanel gastos={recentGastos} source={data.source} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "text-[var(--auth-text)]",
  border = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
  border?: boolean;
}) {
  return (
    <div
      className={`px-4 py-4 sm:px-6 ${
        border ? "border-l border-[var(--auth-divider)]" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-[1.05rem] font-semibold tracking-[-0.025em] tabular-nums sm:text-[1.15rem] ${tone}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-[var(--auth-text-soft)]">
        {hint}
      </p>
    </div>
  );
}

function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1.25rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold shadow-sm">
              <span className="text-[#25f4ee]">T</span>
              <span className="text-[#fe2c55]">T</span>
            </span>
            <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
              Cuentas TikTok
            </h2>
            <span className="rounded-md bg-[var(--auth-bg)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--auth-text-muted)]">
              {accounts.length}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Hecom · solo lectura
          </p>
        </div>
        <Link
          href={routes.adAccounts}
          className="shrink-0 pt-0.5 text-[12px] font-bold text-[var(--auth-accent)] underline-offset-2 hover:underline"
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
                className="flex items-center gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[var(--auth-bg)]"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 h-8 w-[3px] shrink-0 rounded-full ${
                    account.syncEnabled !== false
                      ? "bg-emerald-500"
                      : "bg-[var(--auth-text-soft)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold tracking-[-0.015em] text-[var(--auth-text)]">
                    {label.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--auth-text-muted)]">
                      {shortId(account.advertiserId)}
                    </span>
                    {account.bmBucket ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        BM {account.bmBucket}
                      </span>
                    ) : null}
                    {label.tag ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        {label.tag}
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
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--auth-accent)]">
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
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1.25rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
              Últimos gastos
            </h2>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                source === "hecom_live"
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
                  : "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] ring-1 ring-[var(--auth-divider)]"
              }`}
            >
              {sourceLabel(source)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Consumo reciente de campañas
          </p>
        </div>
        <Link
          href={routes.payments}
          className="shrink-0 pt-0.5 text-[12px] font-bold text-[var(--auth-accent)] underline-offset-2 hover:underline"
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
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[var(--auth-bg)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold tracking-[-0.015em] text-[var(--auth-text)]">
                    {label.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
                    {label.meta ? (
                      <span className="truncate text-[11px] text-[var(--auth-text-soft)]">
                        {label.meta}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--auth-text)]">
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
