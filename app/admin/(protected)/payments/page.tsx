import Link from "next/link";
import { approveManualPaymentAction, rejectManualPaymentAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listManualPayments } from "@/lib/admin/data";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants/status";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const payments = await listManualPayments({ q, status });

  return (
    <>
      <AdminPageHeader
        eyebrow="Finanzas"
        title="Pagos manuales"
        description="Revisión avanzada de vouchers: aprueba pagos, acredita ledger/wallet y notifica al cliente; o rechaza con motivo operativo."
      />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por pago, cliente, referencia o correo…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="requires_payment">Requiere pago</option>
            <option value="processing">Procesando</option>
            <option value="succeeded">Aprobados</option>
            <option value="failed">Rechazados</option>
            <option value="created">Creados</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <TableWrap>
          <Table>
            <thead><tr><Th>Pago</Th><Th>Cliente</Th><Th>Voucher</Th><Th>Monto</Th><Th>Estado</Th><Th>Acción</Th></tr></thead>
            <tbody className="divide-y divide-[var(--admin-table-divider)]">
              {payments.map(({ row, organization, actor, proof }) => (
                <tr key={row.id}>
                  <Td><Link href={`/admin/payments/${row.id}`} className="font-semibold text-[var(--admin-text)] hover:text-[var(--admin-accent)]">{row.id.slice(0, 8)}</Link><p className="text-xs text-[var(--admin-text-muted)]">{formatDateTime(row.created_at)}</p></Td>
                  <Td>{organization?.name ?? "—"}<p className="text-xs text-[var(--admin-text-muted)]">{actor?.email ?? "—"}</p></Td>
                  <Td>{proof ? <span className="font-bold text-emerald-700">{proof.fileName ?? "Adjunto"}</span> : <span className="text-[var(--admin-text-muted)]">Sin voucher</span>}<p className="text-xs text-[var(--admin-text-muted)]">{proof?.uploadedAt ? formatDateTime(proof.uploadedAt) : ""}</p></Td>
                  <Td className="font-semibold text-[var(--admin-text)]">{formatMoney(row.amount_cents, row.currency)}</Td>
                  <Td><StatusBadge status={row.status} label={PAYMENT_STATUS_LABELS[row.status] ?? row.status} /></Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild href={`/admin/payments/${row.id}`} variant="secondary" size="sm">Abrir</Button>
                      {row.status !== "succeeded" && row.status !== "failed" ? (
                        <form action={approveManualPaymentAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <Button type="submit" variant="success" size="sm">Aprobar</Button>
                        </form>
                      ) : null}
                      {row.status !== "succeeded" && row.status !== "failed" ? (
                        <form action={rejectManualPaymentAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="reason" value="Voucher rechazado desde listado administrativo." />
                          <Button type="submit" variant="danger" size="sm">Rechazar</Button>
                        </form>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
