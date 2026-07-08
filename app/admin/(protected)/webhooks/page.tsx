import { updateWebhookStatusAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listWebhooks } from "@/lib/admin/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WebhooksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const provider = typeof params.provider === "string" ? params.provider : "all";
  const events = await listWebhooks({ q, status, provider });

  return (
    <>
      <AdminPageHeader eyebrow="Integraciones externas" title="Webhooks" description="Eventos recibidos de proveedores, con retry manual por cambio de estado y payload auditable." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por event ID, tipo, provider o error…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Estado</option><option value="received">Received</option><option value="processing">Processing</option><option value="processed">Processed</option><option value="failed">Failed</option><option value="ignored">Ignored</option>
          </Select>
          <Select name="provider" defaultValue={provider}>
            <option value="all">Provider</option><option value="stripe">Stripe</option><option value="mercadopago">Mercado Pago</option><option value="culqi">Culqi</option><option value="manual">Manual</option><option value="tiktok">TikTok</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <TableWrap>
          <Table>
            <thead><tr><Th>Evento</Th><Th>Provider</Th><Th>Tipo</Th><Th>Estado</Th><Th>Error</Th><Th>Acción</Th></tr></thead>
            <tbody className="divide-y divide-[#e4eef3]">
              {events.map((event) => (
                <tr key={event.id}>
                  <Td><p className="font-mono text-xs font-black text-[#061925]">{event.event_id}</p><p className="text-xs text-[#789bad]">{formatDateTime(event.created_at)}</p></Td>
                  <Td><Badge tone="purple">{event.provider}</Badge></Td>
                  <Td>{event.event_type}</Td>
                  <Td><StatusBadge status={event.status} /></Td>
                  <Td className="max-w-xs truncate">{event.error_message ?? "—"}</Td>
                  <Td>
                    <form action={updateWebhookStatusAction} className="flex gap-2">
                      <input type="hidden" name="id" value={event.id} />
                      <Select name="status" defaultValue={event.status} className="h-9 rounded-xl text-xs"><option value="received">Received</option><option value="processing">Processing</option><option value="processed">Processed</option><option value="failed">Failed</option><option value="ignored">Ignored</option></Select>
                      <Button type="submit" variant="secondary" size="sm">Guardar</Button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
      {events[0] ? <div className="mt-6"><JsonPreview title="Payload último evento" value={events[0].payload} /></div> : null}
    </>
  );
}
