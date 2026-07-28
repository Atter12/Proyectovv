import Link from "next/link";
import { Card } from "@/components/ui/Card";
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
    return { title: "TikTok Ads", balance: null as string | null, tag: null as string | null };
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

export function ClienteScopedOverview({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, accounts, gastos } = data;
  const recentGastos = gastos.slice(0, 8);

  const kpis = [
    {
      label: "Cuentas TikTok",
      value: String(summary.accountCount),
      accent: "bg-[#8a8178]",
      tone: "text-[#1a1612]",
    },
    {
      label: "Cobros",
      value: moneyUsd(summary.cobroTotal),
      accent: "bg-[#2f7a57]",
      tone: "text-[#1f5c40]",
    },
    {
      label: "Gastos ads",
      value: moneyUsd(summary.gastoTotal),
      accent: "bg-[#c45a18]",
      tone: "text-[#1a1612]",
    },
    {
      label: "Saldo estimado",
      value: moneyUsd(summary.saldoEstimado),
      accent: "bg-[#b45309]",
      tone: "text-[#1a1612]",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
        <div className="relative px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.07),transparent)]"
          />

          <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
            <HecomClienteAvatar
              name={cliente.name}
              avatarUrl={cliente.avatarUrl}
              size="xl"
              className="ring-2 ring-white shadow-[0_8px_20px_rgb(20_18_16_/_0.1)]"
            />
            <p className="mt-4 text-[10px] font-normal uppercase tracking-[0.2em] text-[#8a5a38]">
              Cliente activo
            </p>
            <OverviewClientTitle name={cliente.name} />
            <p className="mt-3 max-w-md text-[13px] font-normal leading-6 tracking-[-0.01em] text-[#6b645c]">
              Resumen del cliente activo: cuentas, cobros, gastos y saldo
              estimado. Vista rápida de cómo viene
              {cliente.biz ? ` · ${cliente.biz}` : ""}.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={routes.adAccounts}
                className="inline-flex h-9 items-center rounded-lg bg-[#e85a1c] px-3.5 text-[12px] font-normal tracking-[-0.01em] text-white transition-colors hover:bg-[#d14e16]"
              >
                Sus cuentas
              </Link>
              <Link
                href={routes.payments}
                className="inline-flex h-9 items-center rounded-lg border border-[rgb(20_18_16_/_0.1)] bg-white px-3.5 text-[12px] font-normal tracking-[-0.01em] text-[#2a241f] transition-colors hover:bg-[#f6f0e8]"
              >
                Sus pagos
              </Link>
            </div>
          </div>
        </div>

        <div
          aria-label="Resumen del cliente"
          className="border-t border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3]"
        >
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi, index) => (
              <div
                key={kpi.label}
                className={`relative px-4 py-4 sm:px-5 ${
                  index % 2 === 0
                    ? "sm:border-r sm:border-[rgb(20_18_16_/_0.06)]"
                    : ""
                } ${
                  index < 2
                    ? "border-b border-[rgb(20_18_16_/_0.06)] xl:border-b-0"
                    : ""
                } ${
                  index < kpis.length - 1
                    ? "xl:border-r xl:border-[rgb(20_18_16_/_0.06)]"
                    : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${kpi.accent}`}
                />
                <p className="pl-2 text-[10px] font-normal uppercase tracking-[0.16em] text-[#7a736a]">
                  {kpi.label}
                </p>
                <p
                  className={`mt-1.5 truncate pl-2 text-[1.25rem] font-light tracking-[-0.035em] tabular-nums sm:text-[1.4rem] ${kpi.tone}`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <AccountsPanel accounts={accounts} />
        <GastosPanel gastos={recentGastos} source={data.source} />
      </div>
    </div>
  );
}

function AccountsPanel({ accounts }: { accounts: HecomTiktokAccount[] }) {
  return (
    <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-0 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold tracking-wide text-white">
            <span className="text-[#25f4ee]">T</span>
            <span className="text-[#fe2c55]">T</span>
          </span>
          <h3 className="text-[13px] font-normal tracking-[-0.02em] text-[#1a1612]">
            Cuentas TikTok
          </h3>
          <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] tabular-nums text-[#6b645c]">
            {accounts.length}
          </span>
        </div>
        <Link
          href={routes.adAccounts}
          className="text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {accounts.length === 0 ? (
        <p className="px-5 py-8 text-[13px] text-[#7a736a]">
          Sin advertiser mapeado en Hecom.
        </p>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-[rgb(20_18_16_/_0.05)] overflow-y-auto">
          {accounts.map((account) => {
            const label = parseAdvertiserLabel(account.advertiserName);
            return (
              <li
                key={account.advertiserId}
                className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-[#faf7f3]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-normal tracking-[-0.015em] text-[#1a1612]">
                    {label.title}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] tracking-wide text-[#9a9187]">
                    {shortId(account.advertiserId)}
                    {account.bmBucket ? ` · BM ${account.bmBucket}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {label.balance ? (
                    <p className="text-[12px] tabular-nums text-[#5c564e]">
                      {label.balance}
                    </p>
                  ) : null}
                  {label.tag ? (
                    <p className="mt-0.5 text-[11px] text-[#9a9187]">
                      {label.tag}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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
    <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-0 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-3.5">
        <h3 className="text-[13px] font-normal tracking-[-0.02em] text-[#1a1612]">
          Últimos gastos
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] text-[#6b645c]">
            {sourceLabel(source)}
          </span>
          <Link
            href={routes.payments}
            className="text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
          >
            Ver pagos
          </Link>
        </div>
      </div>

      {gastos.length === 0 ? (
        <p className="px-5 py-8 text-[13px] text-[#7a736a]">
          Sin gastos registrados para este cliente.
        </p>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-[rgb(20_18_16_/_0.05)] overflow-y-auto">
          {gastos.map((row) => {
            const label = formatHecomGastoDisplay(row.camp, {
              notas: row.notas,
              fee: row.fee,
              fecha: formatHecomFecha(row.fecha ?? row.mes),
            });
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-[#faf7f3]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-normal tracking-[-0.015em] text-[#1a1612]">
                    {label.title}
                  </p>
                  {label.meta ? (
                    <p className="mt-0.5 truncate text-[10px] leading-4 tracking-[-0.01em] text-[#9a9187]">
                      {label.meta}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-[13px] font-light tabular-nums tracking-[-0.02em] text-[#1a1612]">
                  {moneyUsd(row.gasto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
