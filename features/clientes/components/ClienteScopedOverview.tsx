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

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#050d18_0%,#0b4f9c_42%,#178bff_100%)] p-5 shadow-[0_22px_48px_rgb(23_139_255_/_0.28)] sm:p-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.55) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse 70% 80% at 70% 40%, black, transparent)",
          }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-[#9af7c9]/15 blur-3xl" />

        <div className="relative z-10 flex items-start gap-4">
          <HecomClienteAvatar
            name={cliente.name}
            avatarUrl={cliente.avatarUrl}
            size="xl"
            className="ring-2 ring-white/40 shadow-[0_12px_28px_rgb(0_0_0_/_0.35)]"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-[0.06em] text-white/75">
              Vista del cliente
            </p>
            <OverviewClientTitle name={cliente.name} />
            <p className="mt-2 max-w-xl text-[15px] text-white/85">
              Solo datos de esta persona en Hecom Club
              {cliente.biz ? ` · ${cliente.biz}` : ""}.
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-6 flex flex-wrap gap-2">
          <Link
            href={routes.adAccounts}
            className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-[13px] font-semibold text-[#0f7ae5] shadow-md transition-transform hover:-translate-y-0.5"
          >
            Sus cuentas
          </Link>
          <Link
            href={routes.payments}
            className="inline-flex h-10 items-center rounded-xl border border-white/35 bg-white/10 px-4 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            Sus pagos
          </Link>
          <Link
            href={routes.clientes}
            className="inline-flex h-10 items-center rounded-xl border border-white/35 bg-white/10 px-4 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            Cambiar cliente
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Cuentas TikTok" value={String(summary.accountCount)} />
        <Kpi label="Cobros" value={moneyUsd(summary.cobroTotal)} />
        <Kpi label="Gastos ads" value={moneyUsd(summary.gastoTotal)} />
        <Kpi label="Saldo estimado" value={moneyUsd(summary.saldoEstimado)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="dashboard-surface-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-medium">Cuentas TikTok</h3>
            <Badge variant="info">{accounts.length}</Badge>
          </div>
          {accounts.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
              Sin advertiser mapeado en Hecom.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {accounts.map((account) => (
                <li
                  key={account.advertiserId}
                  className="border-b border-[rgb(15_30_52_/_0.08)] pb-3 last:border-0"
                >
                  <p className="font-semibold text-[#0b1628]">
                    {account.advertiserName ?? "TikTok Ads"}
                  </p>
                  <p className="text-xs text-[#5b6b82]">
                    {account.advertiserId}
                    {account.bmBucket ? ` · BM ${account.bmBucket}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="dashboard-surface-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-medium">Últimos gastos</h3>
            <Badge variant="neutral">{data.source}</Badge>
          </div>
          {recentGastos.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
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
                <tbody className="divide-y divide-[rgb(15_30_52_/_0.08)]">
                  {recentGastos.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold">{row.camp ?? "Gasto"}</p>
                        <p className="text-xs text-[#5b6b82]">
                          {row.fecha ?? row.mes ?? ""}
                        </p>
                      </Td>
                      <Td className="font-semibold tabular-nums">
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-kpi rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b6b82]">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.35rem] font-medium tracking-[-0.02em] text-[#0b1628]">
        {value}
      </p>
    </div>
  );
}
