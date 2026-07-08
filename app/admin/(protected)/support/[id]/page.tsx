import Link from "next/link";
import { notFound } from "next/navigation";
import { replyTicketAction, updateTicketAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select, Textarea } from "@/components/ui/Input";
import { getSupportTicketDetail } from "@/lib/admin/data";
import { TICKET_STATUS_LABELS } from "@/lib/constants/status";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getSupportTicketDetail(id);
  if (!detail) notFound();
  const { row, organization, requester, assignee, messages } = detail;

  return (
    <>
      <AdminPageHeader
        eyebrow="Ticket"
        title={row.subject}
        description={`${organization?.name ?? "Sin organización"} · ${requester?.email ?? "sin requester"} · creado ${formatDateTime(row.created_at)}`}
        actions={<Link href="/admin/support" className="text-sm font-black text-[#0e7490] hover:text-[#155e75]">← Volver</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          {messages.map(({ row: message, sender }) => (
            <Card key={message.id} className={`p-5 ${message.internal_note ? "border-amber-200 bg-amber-50" : ""}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-black text-[#061925]">{sender?.full_name ?? sender?.email ?? "Sistema"}</p>
                  {message.internal_note ? <Badge tone="warning">Nota interna</Badge> : <Badge tone="info">Respuesta visible</Badge>}
                </div>
                <p className="text-xs font-bold text-[#789bad]">{formatDateTime(message.created_at)}</p>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#29465a]">{message.body}</p>
            </Card>
          ))}
          {messages.length === 0 ? <Card className="p-8 text-center text-sm font-semibold text-[#5d7280]">El ticket no tiene mensajes.</Card> : null}
          <Card className="p-5">
            <h2 className="text-lg font-black text-[#061925]">Responder ticket</h2>
            <form action={replyTicketAction} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={row.id} />
              <Textarea name="body" placeholder="Escribe la respuesta o nota interna…" required />
              <label className="flex items-center gap-2 text-sm font-bold text-[#5d7280]"><input type="checkbox" name="internal_note" className="h-4 w-4 rounded border-slate-300" /> Guardar como nota interna</label>
              <Button type="submit" className="w-full">Enviar respuesta</Button>
            </form>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-black text-[#061925]">Control del ticket</h2>
            <div className="mt-3"><StatusBadge status={row.status} label={TICKET_STATUS_LABELS[row.status] ?? row.status} /></div>
            <form action={updateTicketAction} className="mt-5 space-y-3">
              <input type="hidden" name="id" value={row.id} />
              <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#789bad]">Estado</label>
              <Select name="status" defaultValue={row.status}>
                <option value="open">Abierto</option>
                <option value="pending">Pendiente</option>
                <option value="resolved">Resuelto</option>
                <option value="closed">Cerrado</option>
              </Select>
              <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#789bad]">Prioridad</label>
              <Select name="priority" defaultValue={row.priority}>
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </Select>
              <label className="flex items-center gap-2 text-sm font-bold text-[#5d7280]"><input type="checkbox" name="assign_to_me" className="h-4 w-4 rounded border-slate-300" /> Asignármelo</label>
              <Button type="submit" variant="secondary" className="w-full">Actualizar</Button>
            </form>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="font-black text-[#789bad]">Asignado</dt><dd className="font-bold text-slate-800">{assignee?.email ?? "—"}</dd></div>
              <div><dt className="font-black text-[#789bad]">Categoría</dt><dd className="font-bold text-slate-800">{row.category ?? "general"}</dd></div>
              <div><dt className="font-black text-[#789bad]">Cerrado</dt><dd className="font-bold text-slate-800">{formatDateTime(row.closed_at)}</dd></div>
            </dl>
          </Card>
          <JsonPreview title="Metadata ticket" value={row.metadata} />
        </div>
      </div>
    </>
  );
}
