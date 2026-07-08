import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listAuditLogs } from "@/lib/admin/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const severity = typeof params.severity === "string" ? params.severity : "all";
  const logs = await listAuditLogs({ q, severity });

  return (
    <>
      <AdminPageHeader eyebrow="Trazabilidad" title="Auditoría" description="Registro de acciones del cliente, backend y equipo operativo. Útil para soporte, compliance y debugging financiero." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar acción, entidad, request, cliente o actor…" />
          <Select name="severity" defaultValue={severity}><option value="all">Severidad</option><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option><option value="critical">Critical</option></Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <TableWrap>
          <Table>
            <thead><tr><Th>Acción</Th><Th>Cliente</Th><Th>Actor</Th><Th>Entidad</Th><Th>Fecha</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(({ row, organization, actor }) => (
                <tr key={row.id}>
                  <Td><p className="font-black text-slate-950">{row.action}</p><Badge tone={row.severity === "warning" ? "warning" : row.severity === "error" || row.severity === "critical" ? "danger" : "neutral"}>{row.severity ?? "info"}</Badge></Td>
                  <Td>{organization?.name ?? "Sistema"}</Td>
                  <Td>{actor?.email ?? "Backend/service role"}</Td>
                  <Td>{row.entity_type}<p className="font-mono text-xs text-slate-400">{row.entity_id ?? "—"}</p></Td>
                  <Td>{formatDateTime(row.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
      {logs[0] ? <div className="mt-6"><JsonPreview title="Metadata último audit log" value={logs[0].row.metadata} /></div> : null}
    </>
  );
}
