import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import {
  moneyUsd,
  type HecomClienteDashboard,
} from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedPayments({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, cobros, gastos } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          Pagos · Hecom
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
          Movimientos de {cliente.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--admin-text-muted,#64748b)]">
          Cobros y gastos de este cliente en Hecom Club (no la wallet genérica de
          la org).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase text-[var(--admin-text-muted,#64748b)]">
            Total cobros
          </p>
          <p className="mt-1 text-xl font-semibold">{moneyUsd(summary.cobroTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase text-[var(--admin-text-muted,#64748b)]">
            Total gastos
          </p>
          <p className="mt-1 text-xl font-semibold">{moneyUsd(summary.gastoTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase text-[var(--admin-text-muted,#64748b)]">
            Saldo estimado
          </p>
          <p className="mt-1 text-xl font-semibold">
            {moneyUsd(summary.saldoEstimado)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cobros / recargas</h2>
            <Badge variant="info">{cobros.length}</Badge>
          </div>
          {cobros.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
              Sin cobros para este cliente.
            </p>
          ) : (
            <TableWrap className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Método</Th>
                    <Th>Monto</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {cobros.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold">{row.fecha ?? "—"}</p>
                        <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                          {row.codigo ?? ""}
                        </p>
                      </Td>
                      <Td>{row.metodo ?? "—"}</Td>
                      <Td className="font-semibold">{moneyUsd(row.monto)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gastos ads</h2>
            <Badge variant="neutral">{gastos.length}</Badge>
          </div>
          {gastos.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
              Sin gastos para este cliente.
            </p>
          ) : (
            <TableWrap className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Detalle</Th>
                    <Th>Fee</Th>
                    <Th>Gasto</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {gastos.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold">{row.camp ?? "Gasto"}</p>
                        <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                          {row.fecha ?? row.mes ?? row.source ?? ""}
                        </p>
                      </Td>
                      <Td>{row.fee != null ? `${row.fee}%` : "—"}</Td>
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
