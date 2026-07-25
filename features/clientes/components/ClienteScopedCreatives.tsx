import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedCreatives({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, creativosClientes, creativosProyectos, summary } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          Creativos · Hecom
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
          Creativos de {cliente.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--admin-text-muted,#64748b)]">
          Proyectos y ficha creativa ligados a este cliente en Hecom Club.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-[11px] uppercase text-[var(--admin-text-muted,#64748b)]">
            Fichas creativas
          </p>
          <p className="mt-1 text-xl font-semibold">{summary.creativeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase text-[var(--admin-text-muted,#64748b)]">
            Proyectos
          </p>
          <p className="mt-1 text-xl font-semibold">{summary.projectCount}</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ficha creativa</h2>
          <Badge variant="info">{creativosClientes.length}</Badge>
        </div>
        {creativosClientes.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
            Este cliente no tiene ficha en Creativos Hecom.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {creativosClientes.map((item) => (
              <li
                key={item.id}
                className="border-b border-[var(--border-subtle)] pb-3 last:border-0"
              >
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  {[item.company, item.email].filter(Boolean).join(" · ") ||
                    "Sin detalle"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Proyectos</h2>
          <Badge variant="neutral">{creativosProyectos.length}</Badge>
        </div>
        {creativosProyectos.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
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
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {creativosProyectos.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-semibold">{row.name}</Td>
                    <Td>{row.type ?? "—"}</Td>
                    <Td>
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
