import { approveRefundAction, rejectRefundAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { listRefundRequests } from "@/lib/admin/data";
import { TRANSACTION_STATUS_LABELS } from "@/lib/constants/status";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RefundsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const refunds = await listRefundRequests({ q, status });

  return (
    <>
      <AdminPageHeader
        eyebrow="Finanzas"
        title="Solicitudes de reembolso"
        description="El cliente crea solicitudes en wallet_transactions tipo refund/pending. El admin aprueba el egreso o rechaza con motivo."
      />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por organización, correo, descripción o ID…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="completed">Aprobados</option>
            <option value="failed">Rechazados</option>
            <option value="cancelled">Cancelados</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <div className="grid gap-5">
          {refunds.map(({ row, organization, actor, wallet }) => (
            <section key={row.id} className="rounded-[1.35rem] border border-[#d7e7ee] bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_16rem_14rem] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--admin-text)]">{organization?.name ?? "—"}</h2>
                    <StatusBadge status={row.status} label={TRANSACTION_STATUS_LABELS[row.status] ?? row.status} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{row.description ?? "Solicitud sin descripción"}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--admin-text-muted)]">{actor?.email ?? "—"} · {formatDateTime(row.created_at)} · Wallet {wallet?.name ?? row.wallet_id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-text-muted)]">Monto solicitado</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--admin-text)]">{formatMoney(row.amount_cents, row.currency)}</p>
                </div>
                {row.status === "pending" ? (
                  <div className="space-y-3">
                    <form action={approveRefundAction} className="space-y-2">
                      <input type="hidden" name="id" value={row.id} />
                      <Textarea name="notes" placeholder="Notas internas…" className="min-h-20" />
                      <Button type="submit" variant="success" size="sm" className="w-full">Aprobar</Button>
                    </form>
                    <form action={rejectRefundAction} className="space-y-2">
                      <input type="hidden" name="id" value={row.id} />
                      <Input name="reason" placeholder="Motivo de rechazo" />
                      <Button type="submit" variant="danger" size="sm" className="w-full">Rechazar</Button>
                    </form>
                  </div>
                ) : <JsonPreview title="Metadata" value={row.metadata} />}
              </div>
            </section>
          ))}
        </div>
        {refunds.length === 0 ? <p className="py-12 text-center text-sm font-semibold text-[var(--admin-text-muted)]">No hay solicitudes con los filtros actuales.</p> : null}
      </Card>
    </>
  );
}
