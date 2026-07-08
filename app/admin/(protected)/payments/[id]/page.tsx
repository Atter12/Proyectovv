import Link from "next/link";
import { notFound } from "next/navigation";
import { approveManualPaymentAction, rejectManualPaymentAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { getManualPaymentDetail } from "@/lib/admin/data";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants/status";
import { compactId, formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getManualPaymentDetail(id);
  if (!detail) notFound();
  const { row, organization, actor, wallet, proof } = detail;

  return (
    <>
      <AdminPageHeader
        eyebrow="Revisión de voucher"
        title={`Pago ${compactId(row.id)}`}
        description={`${organization?.name ?? "Sin organización"} · ${formatMoney(row.amount_cents, row.currency)} · ${formatDateTime(row.created_at)}`}
        actions={<Link href="/admin/payments" className="text-sm font-black text-indigo-600 hover:text-indigo-700">← Volver</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">Estado actual</p>
                <div className="mt-2"><StatusBadge status={row.status} label={PAYMENT_STATUS_LABELS[row.status] ?? row.status} /></div>
              </div>
              <p className="text-3xl font-black tracking-tight text-slate-950">{formatMoney(row.amount_cents, row.currency)}</p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Cliente</p><p className="mt-1 font-black text-slate-950">{organization?.name ?? "—"}</p><p className="text-xs text-slate-400">{organization?.slug}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Solicitado por</p><p className="mt-1 font-black text-slate-950">{actor?.email ?? "—"}</p><p className="text-xs text-slate-400">{actor?.full_name ?? ""}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Wallet</p><p className="mt-1 font-black text-slate-950">{wallet?.name ?? compactId(row.wallet_id)}</p><p className="text-xs text-slate-400">{wallet ? formatMoney(wallet.balance_cents, wallet.currency) : ""}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Referencia</p><p className="mt-1 font-black text-slate-950">{row.provider_reference ?? "—"}</p><p className="text-xs text-slate-400">{row.failure_reason ?? ""}</p></div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-black text-slate-950">Voucher/comprobante</h2>
            {proof ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="font-black text-emerald-800">{proof.fileName ?? "Comprobante cargado"}</p>
                <p className="mt-1 text-sm text-emerald-700">{proof.storagePath ?? proof.publicUrl ?? "Sin path visible"}</p>
                <p className="mt-1 text-xs font-bold text-emerald-600">Subido: {proof.uploadedAt ? formatDateTime(proof.uploadedAt) : "—"}</p>
                {proof.publicUrl || proof.signedUrl ? <a href={proof.publicUrl ?? proof.signedUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-black text-indigo-600 hover:text-indigo-700">Abrir archivo ↗</a> : null}
              </div>
            ) : <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">El cliente todavía no adjuntó voucher.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-black text-slate-950">Ledger relacionado</h2>
            <TableWrap className="mt-4">
              <Table>
                <thead><tr><Th>Journal</Th><Th>Tipo</Th><Th>Monto</Th><Th>Estado</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.journals.map((journal) => (
                    <tr key={journal.id}>
                      <Td className="font-mono text-xs">{journal.id}</Td>
                      <Td>{journal.journal_type}</Td>
                      <Td className="font-black text-slate-950">{formatMoney(journal.amount_cents, journal.currency)}</Td>
                      <Td><StatusBadge status={journal.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </div>

        <div className="space-y-6">
          {row.status !== "succeeded" && row.status !== "failed" ? (
            <Card className="p-5">
              <h2 className="text-lg font-black text-slate-950">Decisión administrativa</h2>
              <form action={approveManualPaymentAction} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={row.id} />
                <Textarea name="notes" placeholder="Notas internas de aprobación…" />
                <Button type="submit" variant="success" className="w-full">Aprobar y acreditar ledger</Button>
              </form>
              <form action={rejectManualPaymentAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <input type="hidden" name="id" value={row.id} />
                <Textarea name="reason" placeholder="Motivo visible para el cliente…" required />
                <Button type="submit" variant="danger" className="w-full">Rechazar voucher</Button>
              </form>
            </Card>
          ) : null}
          <JsonPreview title="Metadata del pago" value={row.metadata} />
          <JsonPreview title="Auditoría vinculada" value={detail.audit} />
        </div>
      </div>
    </>
  );
}
