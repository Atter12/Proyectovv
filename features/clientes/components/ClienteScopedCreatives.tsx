import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import {
  ClienteScopeKpi,
  ClienteScopePageHeader,
} from "@/features/clientes/components/ClienteScopePageChrome";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedCreatives({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, creativosClientes, creativosProyectos, summary } = data;

  return (
    <div className="space-y-6">
      <ClienteScopePageHeader
        eyebrow="Creativos · Hecom"
        title={`Creativos de ${cliente.name}`}
        description="Proyectos y ficha creativa ligados a este cliente en Hecom Club."
        name={cliente.name}
        avatarUrl={cliente.avatarUrl}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ClienteScopeKpi
          label="Fichas creativas"
          value={String(summary.creativeCount)}
        />
        <ClienteScopeKpi
          label="Proyectos"
          value={String(summary.projectCount)}
        />
      </div>

      <Card className="dashboard-surface-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-[#141210]">
            Ficha creativa
          </h2>
          <Badge variant="info">{creativosClientes.length}</Badge>
        </div>
        {creativosClientes.length === 0 ? (
          <p className="mt-4 text-sm text-[#6b645c]">
            Este cliente no tiene ficha en Creativos Hecom.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {creativosClientes.map((item) => (
              <li
                key={item.id}
                className="border-b border-[rgb(20_18_16_/_0.08)] pb-3 last:border-0"
              >
                <p className="font-semibold text-[#141210]">{item.name}</p>
                <p className="text-xs text-[#6b645c]">
                  {[item.company, item.email].filter(Boolean).join(" · ") ||
                    "Sin detalle"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="dashboard-surface-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-[#141210]">
            Proyectos
          </h2>
          <Badge variant="neutral">{creativosProyectos.length}</Badge>
        </div>
        {creativosProyectos.length === 0 ? (
          <p className="mt-4 text-sm text-[#6b645c]">
            Sin proyectos creativos asociados.
          </p>
        ) : (
          <TableWrap className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Proyecto</Th>
                  <Th>Tipo</Th>
                  <Th>Plataforma</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(20_18_16_/_0.08)]">
                {creativosProyectos.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-semibold text-[#141210]">{row.name}</Td>
                    <Td className="text-[#6b645c]">{row.type ?? "—"}</Td>
                    <Td className="text-[#6b645c]">
                      {row.platform ?? "—"}
                      {row.format ? ` · ${row.format}` : ""}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
