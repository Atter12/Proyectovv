import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { routes } from "@/config/routes";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
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
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0b4f9c_0%,#178bff_52%,#0f7ae5_100%)] p-5 shadow-[0_18px_40px_rgb(23_139_255_/_0.22)] sm:p-7">
        <div className="flex items-start gap-4">
          <HecomClienteAvatar
            name={cliente.name}
            avatarUrl={cliente.avatarUrl}
            size="xl"
            className="ring-2 ring-white/40"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-[0.04em] text-white/80">
              Vista del cliente
            </p>
            <h2 className="font-display mt-2 text-[1.75rem] font-medium text-white sm:text-[2rem]">
              {cliente.name}
            </h2>
            <p className="mt-2 max-w-xl text-[15px] text-white/85">
              Solo datos de esta persona en Hecom Club
              {cliente.biz ? ` · ${cliente.biz}` : ""}.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={routes.adAccounts}
            className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-[13px] font-semibold text-[var(--brand-primary)]"
          >
            Sus cuentas
          </Link>
          <Link
            href={routes.payments}
            className="inline-flex h-10 items-center rounded-xl border border-white/35 bg-white/10 px-4 text-[13px] font-semibold text-white"
          >
            Sus pagos
          </Link>
          <Link
            href={routes.clientes}
            className="inline-flex h-10 items-center rounded-xl border border-white/35 bg-white/10 px-4 text-[13px] font-semibold text-white"
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
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Cuentas TikTok</h3>
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
                  className="border-b border-[var(--border-subtle)] pb-3 last:border-0"
                >
                  <p className="font-semibold">
                    {account.advertiserName ?? "TikTok Ads"}
                  </p>
                  <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                    {account.advertiserId}
                    {account.bmBucket ? ` · BM ${account.bmBucket}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Últimos gastos</h3>
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
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {recentGastos.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold">{row.camp ?? "Gasto"}</p>
                        <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                          {row.fecha ?? row.mes ?? ""}
                        </p>
                      </Td>
                      <Td className="font-semibold">{moneyUsd(row.gasto)}</Td>
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
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">{value}</p>
    </Card>
  );
}
