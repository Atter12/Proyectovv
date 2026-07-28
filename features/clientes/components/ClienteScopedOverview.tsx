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
 * Overview = “desk brief” del cliente activo.
 * Asimétrico, tipografía Manrope con jerarquía clara (no centrado tipo perfil IG).
 */
export function ClienteScopedOverview({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, accounts, gastos } = data;
  const recentGastos = gastos.slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Identity + pulse */}
      <section className="relative overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#e85a1c,#ffa12c)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[rgb(255_120_31_/_0.07)] blur-3xl"
        />

        <div className="relative grid gap-8 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)] lg:items-end lg:gap-10">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <HecomClienteAvatar
              name={cliente.name}
              avatarUrl={cliente.avatarUrl}
              size="lg"
              className="mt-0.5 ring-2 ring-white shadow-[0_10px_28px_rgb(20_18_16_/_0.12)]"
            />
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c45a18]">
                Cliente activo
              </p>
              <OverviewClientTitle name={cliente.name} />
              <p className="mt-2 max-w-md text-[14px] leading-6 text-[#5c564e]">
                Pulso del mes
                {cliente.biz ? (
                  <>
                    {" · "}
                    <span className="font-medium text-[#2a241f]">
                      {cliente.biz}
                    </span>
                  </>
                ) : null}
                : cuentas, cobros, gastos y saldo.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link
                  href={routes.adAccounts}
                  className="inline-flex h-10 items-center rounded-md bg-[#e85a1c] px-4 text-[13px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-[#d14e16]"
                >
                  Sus cuentas
                </Link>
                <Link
                  href={routes.payments}
                  className="inline-flex h-10 items-center rounded-md border border-[rgb(20_18_16_/_0.12)] bg-transparent px-4 text-[13px] font-semibold tracking-[-0.01em] text-[#1a1612] transition-colors hover:bg-[#f6f0e8]"
                >
                  Sus pagos
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-[rgb(20_18_16_/_0.08)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8178]">
              Saldo estimado
            </p>
            <p className="mt-2 text-[2.35rem] font-semibold leading-none tracking-[-0.045em] tabular-nums text-[#1a1612] sm:text-[2.65rem]">
              {moneyUsd(summary.saldoEstimado)}
            </p>
            <p className="mt-3 text-[13px] leading-5 text-[#7a736a]">
              Cobros {moneyUsd(summary.cobroTotal)} − gastos{" "}
              {moneyUsd(summary.gastoTotal)}
            </p>
          </div>
        </div>

        {/* Compact metrics — ledger strip */}
        <div
          aria-label="Indicadores"
          className="grid grid-cols-3 border-t border-[rgb(20_18_16_/_0.08)] bg-[#f7f3ee]"
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
            tone="text-[#1f5c40]"
            border
          />
          <Metric
            label="Gastos ads"
            value={moneyUsd(summary.gastoTotal)}
            hint="Consumo"
            border
          />
        </div>
      </section>

      {/* Detail panels */}
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
  tone = "text-[#1a1612]",
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
        border ? "border-l border-[rgb(20_18_16_/_0.08)]" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8178]">
        {label}
      </p>
      <p
        className={`mt-1.5 truncate text-[1.15rem] font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.3rem] ${tone}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#9a9187]">{hint}</p>
    </div>
  );
}

function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.07)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold shadow-sm">
              <span className="text-[#25f4ee]">T</span>
              <span className="text-[#fe2c55]">T</span>
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1612]">
              Cuentas TikTok
            </h2>
            <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#5c564e]">
              {accounts.length}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-[#7a736a]">
            Hecom · solo lectura
          </p>
        </div>
        <Link
          href={routes.adAccounts}
          className="shrink-0 pt-0.5 text-[12px] font-semibold text-[#c45a18] underline-offset-2 hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {accounts.length === 0 ? (
        <p className="px-5 py-10 text-[13px] text-[#7a736a]">
          Sin advertiser mapeado en Hecom.
        </p>
      ) : (
        <ul className="max-h-[24rem] flex-1 overflow-y-auto">
          {accounts.map((account) => {
            const label = parseAdvertiserLabel(account.advertiserName);
            return (
              <li
                key={account.advertiserId}
                className="flex items-center gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[#faf7f3]"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 h-8 w-[3px] shrink-0 rounded-full ${
                    account.syncEnabled !== false ? "bg-[#2f7a57]" : "bg-[#c4bbb0]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    {label.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 font-mono text-[10px] text-[#6b645c]">
                      {shortId(account.advertiserId)}
                    </span>
                    {account.bmBucket ? (
                      <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]">
                        BM {account.bmBucket}
                      </span>
                    ) : null}
                    {label.tag ? (
                      <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]">
                        {label.tag}
                      </span>
                    ) : null}
                    {account.fee != null ? (
                      <span className="rounded bg-[#fff1e8] px-1.5 py-0.5 text-[10px] font-semibold text-[#c45a18]">
                        Fee {account.fee}%
                      </span>
                    ) : null}
                  </div>
                </div>
                {label.balance ? (
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums tracking-[-0.02em] text-[#c45a18]">
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
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.07)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1612]">
              Últimos gastos
            </h2>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                source === "hecom_live"
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
                  : "bg-[#f3eee8] text-[#5c564e] ring-1 ring-[rgb(20_18_16_/_0.08)]"
              }`}
            >
              {sourceLabel(source)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-[#7a736a]">
            Consumo reciente de campañas
          </p>
        </div>
        <Link
          href={routes.payments}
          className="shrink-0 pt-0.5 text-[12px] font-semibold text-[#c45a18] underline-offset-2 hover:underline"
        >
          Ver pagos
        </Link>
      </div>

      {gastos.length === 0 ? (
        <p className="px-5 py-10 text-[13px] text-[#7a736a]">
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
                className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[#faf7f3]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    {label.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#6b645c]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.fee != null ? (
                      <span className="rounded bg-[#fff1e8] px-1.5 py-0.5 text-[10px] font-semibold text-[#c45a18]">
                        Fee {row.fee}%
                      </span>
                    ) : null}
                    {label.meta ? (
                      <span className="truncate text-[11px] text-[#9a9187]">
                        {label.meta}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1612]">
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
