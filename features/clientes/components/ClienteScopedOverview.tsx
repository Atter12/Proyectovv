import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
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
 * Descripción general — inspirado en Rockads (hero amplio, números, acciones),
 * con acento Holistic #ff781f.
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
    <div className="space-y-8 sm:space-y-10">
      {/* Hero — una composición, marca + cliente + saldo */}
      <section className="overview-hero relative overflow-hidden rounded-[1.5rem] border border-[rgb(20_18_16_/_0.06)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(255_120_31_/_0.18),transparent_55%),radial-gradient(90%_70%_at_100%_10%,rgb(255_161_44_/_0.12),transparent_50%),linear-gradient(165deg,#fff8f3_0%,#ffffff_42%,#fff4ec_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-[-20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgb(255_120_31_/_0.22),transparent_68%)] blur-2xl"
        />
        <div
          aria-hidden
          className="overview-hero-grid pointer-events-none absolute inset-0 opacity-[0.35]"
        />

        <div className="relative grid gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)] lg:items-center lg:gap-12 lg:px-10 lg:py-11">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="lg"
                className="ring-2 ring-white/90 shadow-[0_14px_36px_rgb(255_120_31_/_0.22)]"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
                  {siteConfig.name}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-[var(--auth-text-muted)]">
                  Descripción general
                  {cliente.biz ? ` · ${cliente.biz}` : ""}
                </p>
              </div>
            </div>

            <OverviewClientTitle name={cliente.name} />

            <p className="mt-3 max-w-xl text-[15px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[16px] sm:leading-7">
              Pulso de operación: cuentas TikTok, cobros Hecom y gasto ads — en
              un solo lugar para crecer con control.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href={routes.adAccounts}
                className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.3)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
              >
                Ver cuentas
              </Link>
              <Link
                href={routes.payments}
                className="inline-flex h-11 items-center rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white/80 px-5 text-[14px] font-semibold text-[var(--auth-text)] backdrop-blur-sm transition-colors hover:bg-white"
              >
                Ir a pagos
              </Link>
            </div>
          </div>

          <div className="overview-hero-balance relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/75 p-5 shadow-[0_20px_50px_rgb(255_120_31_/_0.12)] backdrop-blur-md sm:p-6">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-text-soft)]">
                {debt ? "Deuda neta" : "Saldo estimado"}
              </p>
              <p
                className={`mt-2 font-display text-[2.15rem] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[2.5rem] ${
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
        </div>
      </section>

      {/* Qué podés hacer — estilo Rockads Core */}
      <section aria-labelledby="overview-actions-heading">
        <div className="mb-4 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
            Qué podés hacer
          </p>
          <h2
            id="overview-actions-heading"
            className="font-display mt-1.5 text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.5rem]"
          >
            Herramientas para operar a {cliente.name.split(" ")[0]}
          </h2>
          <p className="mt-1.5 text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
            Acceso rápido a cuentas, fondeo y movimientos — sin salir del
            panel.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ActionTile
            href={routes.adAccounts}
            title="Account Center"
            body="Revisá advertisers TikTok mapeados y su estado."
            icon="accounts"
          />
          <ActionTile
            href={routes.payments}
            title="Fondeo y cartera"
            body="Stripe (cliente) o cash BM (gerente) hacia ads."
            icon="wallet"
          />
          <ActionTile
            href={`${routes.payments}#asignar-saldo`}
            title="Asignar a ads"
            body="Mové presupuesto a la cuenta publicitaria lista."
            icon="boost"
          />
        </div>
      </section>

      {/* Números — Rockads “in numbers” */}
      <section
        aria-label="Indicadores del cliente"
        className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.07)] bg-[#0f0e0c] text-white shadow-[0_18px_40px_rgb(15_14_12_/_0.18)]"
      >
        <div className="border-b border-white/10 px-5 py-4 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4a]">
            Holistic en números
          </p>
          <p className="mt-1 text-[14px] font-medium text-white/70">
            Pulso del cliente seleccionado
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <StatCell
            label="Cuentas"
            value={String(summary.accountCount)}
            hint="TikTok"
          />
          <StatCell
            label="Cobros"
            value={moneyUsd(summary.cobroTotal)}
            hint="Entradas"
            accent
          />
          <StatCell
            label="Gastos ads"
            value={moneyUsd(summary.gastoTotal)}
            hint="Consumo"
          />
          <StatCell
            label="Fees"
            value={moneyUsd(summary.feeTotal)}
            hint="Servicio"
          />
        </div>
      </section>

      {/* Paneles detalle */}
      <div className="grid gap-5 xl:grid-cols-2">
        <AccountsPanel accounts={accounts} />
        <GastosPanel gastos={recentGastos} source={data.source} />
      </div>
    </div>
  );
}

function ActionTile({
  href,
  title,
  body,
  icon,
}: {
  href: string;
  title: string;
  body: string;
  icon: "accounts" | "wallet" | "boost";
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[1.2rem] border border-[rgb(20_18_16_/_0.08)] bg-white p-5 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[rgb(255_120_31_/_0.35)] hover:shadow-[0_16px_36px_rgb(255_120_31_/_0.12)]"
    >
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[rgb(255_120_31_/_0.08)] transition-transform group-hover:scale-125"
      />
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]">
        <ActionIcon type={icon} />
      </span>
      <p className="relative mt-3 text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
        {title}
      </p>
      <p className="relative mt-1 text-[13px] leading-5 text-[var(--auth-text-muted)]">
        {body}
      </p>
      <span className="relative mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--auth-accent)]">
        Abrir
        <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </span>
    </Link>
  );
}

function ActionIcon({ type }: { type: "accounts" | "wallet" | "boost" }) {
  if (type === "accounts") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    );
  }
  if (type === "wallet") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function StatCell({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="border-t border-white/10 px-5 py-5 sm:border-t-0 sm:border-l sm:border-white/10 sm:px-6 sm:first:border-l-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p
        className={`mt-2 truncate font-display text-[1.2rem] font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.35rem] ${
          accent ? "text-[#ff9a4a]" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-white/40">{hint}</p>
    </div>
  );
}

function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1.35rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#16161a] text-[9px] font-bold shadow-sm">
              <span className="text-[#25f4ee]">T</span>
              <span className="text-[#fe2c55]">T</span>
            </span>
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
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
        <p className="px-5 py-10 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-6">
          Sin advertiser mapeado en Hecom.
        </p>
      ) : (
        <ul className="max-h-[24rem] flex-1 overflow-y-auto">
          {accounts.map((account) => {
            const label = parseAdvertiserLabel(account.advertiserName);
            return (
              <li
                key={account.advertiserId}
                className="flex items-center gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[var(--auth-bg)] sm:px-6"
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
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1.35rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
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
        <p className="px-5 py-10 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-6">
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
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[var(--auth-bg)] sm:px-6"
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
