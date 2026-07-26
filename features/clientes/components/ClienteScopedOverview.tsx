import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { routes } from "@/config/routes";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { OverviewClientTitle } from "@/features/clientes/components/OverviewClientTitle.client";
import {
  moneyUsd,
  type HecomClienteDashboard,
} from "@/lib/hecom/cliente-dashboard.server";

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
      {/* Perfil: identidad centrada (CRM), acciones y métricas debajo */}
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
            <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a5a38]">
              Cliente activo
            </p>
            <OverviewClientTitle name={cliente.name} />
            <p className="mt-2 max-w-md text-[13px] leading-5 text-[#6b645c]">
              Solo datos de esta persona en Hecom Club
              {cliente.biz ? ` · ${cliente.biz}` : ""}.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={routes.adAccounts}
                className="inline-flex h-9 items-center rounded-lg bg-[#e85a1c] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#d14e16]"
              >
                Sus cuentas
              </Link>
              <Link
                href={routes.payments}
                className="inline-flex h-9 items-center rounded-lg border border-[rgb(20_18_16_/_0.1)] bg-white px-3.5 text-[13px] font-medium text-[#2a241f] transition-colors hover:bg-[#f6f0e8]"
              >
                Sus pagos
              </Link>
              <Link
                href={routes.clientes}
                className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-[#6b645c] transition-colors hover:bg-[#f6f0e8] hover:text-[#1a1612]"
              >
                Cambiar cliente
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
                <p className="pl-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
                  {kpi.label}
                </p>
                <p
                  className={`mt-1 truncate pl-2 text-[1.2rem] font-medium tracking-[-0.015em] tabular-nums sm:text-[1.3rem] ${kpi.tone}`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-5 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-medium text-[#1a1612]">
              Cuentas TikTok
            </h3>
            <Badge variant="neutral">{accounts.length}</Badge>
          </div>
          {accounts.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#7a736a]">
              Sin advertiser mapeado en Hecom.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {accounts.map((account) => (
                <li
                  key={account.advertiserId}
                  className="border-b border-[rgb(20_18_16_/_0.06)] pb-3 last:border-0"
                >
                  <p className="text-[14px] font-medium text-[#1a1612]">
                    {account.advertiserName ?? "TikTok Ads"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#7a736a]">
                    {account.advertiserId}
                    {account.bmBucket ? ` · BM ${account.bmBucket}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-5 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-medium text-[#1a1612]">
              Últimos gastos
            </h3>
            <Badge variant="neutral">{data.source}</Badge>
          </div>
          {recentGastos.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#7a736a]">
              Sin gastos registrados para este cliente.
            </p>
          ) : (
            <TableWrap className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Campaña</Th>
                    <Th>Monto</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(20_18_16_/_0.06)]">
                  {recentGastos.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="text-[13px] font-medium">{row.camp ?? "Gasto"}</p>
                        <p className="text-[11px] text-[#7a736a]">
                          {row.fecha ?? row.mes ?? ""}
                        </p>
                      </Td>
                      <Td className="text-[13px] font-medium tabular-nums">
                        {moneyUsd(row.gasto)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
