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
      <div className="dashboard-surface-card relative overflow-hidden rounded-[1.5rem] p-5 sm:p-7">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-primary),var(--brand-accent))]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[var(--brand-primary)]/[0.08] blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 flex items-start gap-4 pl-2">
          <HecomClienteAvatar
            name={cliente.name}
            avatarUrl={cliente.avatarUrl}
            size="xl"
            className="ring-2 ring-[var(--brand-primary)]/20 shadow-[0_10px_24px_rgb(20_18_16_/_0.12)]"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-[0.06em] text-[var(--brand-primary-deep)]">
              Vista del cliente
            </p>
            <OverviewClientTitle name={cliente.name} />
            <p className="mt-2 max-w-xl text-[15px] text-[#6b645c]">
              Solo datos de esta persona en Hecom Club
              {cliente.biz ? ` · ${cliente.biz}` : ""}.
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-6 flex flex-wrap gap-2 pl-2">
          <Link
            href={routes.adAccounts}
            className="inline-flex h-10 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--brand-primary-deep)]"
          >
            Sus cuentas
          </Link>
          <Link
            href={routes.payments}
            className="inline-flex h-10 items-center rounded-xl border border-[var(--border-subtle)] bg-white px-4 text-[13px] font-semibold text-[#141210] transition-colors hover:border-[var(--brand-primary)]/30 hover:bg-[var(--surface-soft)]"
          >
            Sus pagos
          </Link>
          <Link
            href={routes.clientes}
            className="inline-flex h-10 items-center rounded-xl border border-[var(--border-subtle)] bg-white px-4 text-[13px] font-semibold text-[#6b645c] transition-colors hover:border-[var(--brand-primary)]/30 hover:text-[#141210]"
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
                  className="border-b border-[rgb(20_18_16_/_0.08)] pb-3 last:border-0"
                >
                  <p className="font-semibold text-[#141210]">
                    {account.advertiserName ?? "TikTok Ads"}
                  </p>
                  <p className="text-xs text-[#6b645c]">
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
                <tbody className="divide-y divide-[rgb(20_18_16_/_0.08)]">
                  {recentGastos.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold">{row.camp ?? "Gasto"}</p>
                        <p className="text-xs text-[#6b645c]">
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b645c]">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.35rem] font-medium tracking-[-0.02em] text-[#141210]">
        {value}
      </p>
    </div>
  );
}
