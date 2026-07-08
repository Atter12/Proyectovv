import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listSupportTickets } from "@/lib/admin/data";
import { TICKET_STATUS_LABELS } from "@/lib/constants/status";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const priority = typeof params.priority === "string" ? params.priority : "all";
  const tickets = await listSupportTickets({ q, status, priority });

  return (
    <>
      <AdminPageHeader eyebrow="Helpdesk" title="Soporte" description="Tickets reales creados desde el chat del cliente, con estados, prioridad, asignación y notas internas." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por asunto, cliente, categoría o correo…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Estado</option>
            <option value="open">Abierto</option>
            <option value="pending">Pendiente</option>
            <option value="resolved">Resuelto</option>
            <option value="closed">Cerrado</option>
          </Select>
          <Select name="priority" defaultValue={priority}>
            <option value="all">Prioridad</option>
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <TableWrap>
          <Table>
            <thead><tr><Th>Ticket</Th><Th>Cliente</Th><Th>Solicitante</Th><Th>Prioridad</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map(({ row, organization, requester, assignee }) => (
                <tr key={row.id}>
                  <Td><Link href={`/admin/support/${row.id}`} className="font-black text-slate-950 hover:text-indigo-600">{row.subject}</Link><p className="text-xs text-slate-400">{formatDateTime(row.updated_at ?? row.created_at)}</p></Td>
                  <Td>{organization?.name ?? "—"}<p className="text-xs text-slate-400">{row.category ?? "general"}</p></Td>
                  <Td>{requester?.email ?? "—"}<p className="text-xs text-slate-400">Asignado: {assignee?.email ?? "sin asignar"}</p></Td>
                  <Td><Badge tone={row.priority === "urgent" || row.priority === "high" ? "danger" : "neutral"}>{row.priority}</Badge></Td>
                  <Td><StatusBadge status={row.status} label={TICKET_STATUS_LABELS[row.status] ?? row.status} /></Td>
                  <Td><Button asChild href={`/admin/support/${row.id}`} variant="secondary" size="sm">Responder</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
