import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KpiCard } from "@/components/admin/KpiCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { getOverviewData } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PAYMENT_STATUS_LABELS, TICKET_STATUS_LABELS } from "@/lib/constants/status";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const data = await getOverviewData();
  const { counts } = data;

  return (
    <>
      <AdminPageHeader
        eyebrow="Centro operativo"
        title="Resumen administrativo"
        description="Vista ejecutiva del estado de la plataforma: usuarios, organizaciones, pagos pendientes, reembolsos, soporte, webhooks y exposición de wallets."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Organizaciones" value={String(counts.organizations)} detail={`${counts.profiles} perfiles registrados`} accent="indigo" />
        <KpiCard label="Saldo wallets" value={formatMoney(counts.totalWalletBalanceCents, counts.primaryCurrency)} detail={`${formatMoney(counts.totalReservedCents, counts.primaryCurrency)} reservado`} accent="emerald" />
        <KpiCard label="Pagos por revisar" value={String(counts.pendingPayments)} detail="Manual / voucher pendiente" accent="amber" />
        <KpiCard label="Alertas operativas" value={String(counts.pendingRefunds + counts.openTickets + counts.failedWebhooks)} detail={`${counts.openTickets} tickets, ${counts.failedWebhooks} webhooks fallidos`} accent="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Pagos recientes</h2>
              <p className="text-sm text-slate-500">Incluye manuales y proveedores externos.</p>
            </div>
            <Link href="/admin/payments" className="text-sm font-black text-indigo-600 hover:text-indigo-700">Ver pagos</Link>
          </div>
          <TableWrap>
            <Table>
              <thead><tr><Th>Pago</Th><Th>Cliente</Th><Th>Monto</Th><Th>Estado</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentPayments.map(({ row, organization }) => (
                  <tr key={row.id}>
                    <Td><Link href={`/admin/payments/${row.id}`} className="font-black text-slate-950 hover:text-indigo-600">{row.id.slice(0, 8)}</Link><p className="text-xs text-slate-400">{formatDateTime(row.created_at)}</p></Td>
                    <Td>{organization?.name ?? "—"}<p className="text-xs text-slate-400">{row.provider}</p></Td>
                    <Td className="font-black text-slate-950">{formatMoney(row.amount_cents, row.currency)}</Td>
                    <Td><StatusBadge status={row.status} label={PAYMENT_STATUS_LABELS[row.status] ?? row.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Tickets recientes</h2>
              <p className="text-sm text-slate-500">Conversaciones reales desde el chat cliente.</p>
            </div>
            <Link href="/admin/support" className="text-sm font-black text-indigo-600 hover:text-indigo-700">Ver soporte</Link>
          </div>
          <TableWrap>
            <Table>
              <thead><tr><Th>Ticket</Th><Th>Cliente</Th><Th>Prioridad</Th><Th>Estado</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentTickets.map(({ row, organization, requester }) => (
                  <tr key={row.id}>
                    <Td><Link href={`/admin/support/${row.id}`} className="font-black text-slate-950 hover:text-indigo-600">{row.subject}</Link><p className="text-xs text-slate-400">{formatDateTime(row.updated_at ?? row.created_at)}</p></Td>
                    <Td>{organization?.name ?? "—"}<p className="text-xs text-slate-400">{requester?.email ?? "—"}</p></Td>
                    <Td className="font-bold capitalize">{row.priority}</Td>
                    <Td><StatusBadge status={row.status} label={TICKET_STATUS_LABELS[row.status] ?? row.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-black text-slate-950">Última actividad auditada</h2>
        <div className="mt-4 grid gap-3">
          {data.recentAudit.map(({ row, organization, actor }) => (
            <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-slate-950">{row.action}</p>
                <span className="text-xs font-bold text-slate-400">{formatDateTime(row.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{organization?.name ?? "Sistema"} · {actor?.email ?? "Backend/service role"} · {row.entity_type}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
