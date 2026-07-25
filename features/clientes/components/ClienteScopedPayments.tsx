import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import {
  ClienteScopeKpi,
  ClienteScopePageHeader,
} from "@/features/clientes/components/ClienteScopePageChrome";
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
      <ClienteScopePageHeader
        eyebrow="Pagos · Hecom"
        title={`Movimientos de ${cliente.name}`}
        description="Cobros y gastos de este cliente en Hecom Club (no la wallet genérica de la org)."
        name={cliente.name}
        avatarUrl={cliente.avatarUrl}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <ClienteScopeKpi label="Total cobros" value={moneyUsd(summary.cobroTotal)} />
        <ClienteScopeKpi label="Total gastos" value={moneyUsd(summary.gastoTotal)} />
        <ClienteScopeKpi
          label="Saldo estimado"
          value={moneyUsd(summary.saldoEstimado)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="dashboard-surface-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-[#0b1628]">
              Cobros / recargas
            </h2>
            <Badge variant="info">{cobros.length}</Badge>
          </div>
          {cobros.length === 0 ? (
            <p className="mt-4 text-sm text-[#5b6b82]">Sin cobros para este cliente.</p>
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
                <tbody className="divide-y divide-[rgb(15_30_52_/_0.08)]">
                  {cobros.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold text-[#0b1628]">{row.fecha ?? "—"}</p>
                        <p className="text-xs text-[#5b6b82]">{row.codigo ?? ""}</p>
                      </Td>
                      <Td className="text-[#5b6b82]">{row.metodo ?? "—"}</Td>
                      <Td className="font-semibold tabular-nums text-[#0b1628]">
                        {moneyUsd(row.monto)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card className="dashboard-surface-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-[#0b1628]">
              Gastos ads
            </h2>
            <Badge variant="neutral">{gastos.length}</Badge>
          </div>
          {gastos.length === 0 ? (
            <p className="mt-4 text-sm text-[#5b6b82]">Sin gastos para este cliente.</p>
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
                <tbody className="divide-y divide-[rgb(15_30_52_/_0.08)]">
                  {gastos.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <p className="font-semibold text-[#0b1628]">
                          {row.camp ?? "Gasto"}
                        </p>
                        <p className="text-xs text-[#5b6b82]">
                          {row.fecha ?? row.mes ?? row.source ?? ""}
                        </p>
                      </Td>
                      <Td className="text-[#5b6b82]">
                        {row.fee != null ? `${row.fee}%` : "—"}
                      </Td>
                      <Td className="font-semibold tabular-nums text-[#0b1628]">
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
