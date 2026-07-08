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

function WorkloadChip({ label, value, href }: { label: string; value: number; href: string }) {
  const hasWork = value > 0;
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-white/[0.065] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#74d3b4]/35 hover:bg-white/[0.09]"
    >
      <span className="flex items-center justify-between gap-3 text-[#9dd5e3]">
        <span className="text-sm font-bold">{label}</span>
        <span className={hasWork ? "h-2 w-2 rounded-full bg-[#f4c95d]" : "h-2 w-2 rounded-full bg-[#59c493]"} aria-hidden />
      </span>
      <strong className="mt-2 block text-2xl font-black tracking-tight text-white">{value}</strong>
    </Link>
  );
}

export default async function OverviewPage() {
  const data = await getOverviewData();
  const { counts } = data;
  const priorityTotal = counts.pendingPayments + counts.pendingRefunds + counts.openTickets + counts.failedWebhooks;

  return (
    <>
      <AdminPageHeader
        eyebrow="Centro operativo"
        title="Resumen administrativo"
        description="Vista ejecutiva del estado de la plataforma: usuarios, organizaciones, pagos pendientes, reembolsos, soporte, webhooks y exposición de wallets."
      />

      <Card tone="dark" className="admin-priority-panel mb-6 p-0">
        <div className="absolute inset-0 bg-[radial-gradient(620px_240px_at_0%_0%,rgba(116,211,180,0.16),transparent_58%),radial-gradient(520px_260px_at_100%_0%,rgba(117,199,232,0.12),transparent_58%)]" aria-hidden />
        <div className="relative grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-stretch lg:p-6">
          <div className="flex min-h-[9rem] flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#74d3b4]/18 bg-[#74d3b4]/8 px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.22em] text-[#9af7c9]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]" aria-hidden />
                Prioridad del día
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-[-0.025em] text-white sm:text-3xl">
                {priorityTotal} asuntos requieren seguimiento operativo
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-[#c7dce5]">
                Pagos manuales, reembolsos, tickets y webhooks se muestran como cola de trabajo para que el administrador actúe primero sobre lo crítico.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/admin/payments" className="rounded-full bg-[#74d3b4] px-4 py-2 text-xs font-black text-[#062235] transition hover:bg-[#9af7c9]">Revisar cola financiera</Link>
              <Link href="/admin/audit" className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-white transition hover:border-white/20 hover:bg-white/[0.10]">Ver auditoría</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <WorkloadChip label="Pagos" value={counts.pendingPayments} href="/admin/payments" />
            <WorkloadChip label="Tickets" value={counts.openTickets} href="/admin/support" />
            <WorkloadChip label="Reembolsos" value={counts.pendingRefunds} href="/admin/refunds" />
            <WorkloadChip label="Webhooks" value={counts.failedWebhooks} href="/admin/webhooks" />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Organizaciones" value={String(counts.organizations)} detail={`${counts.profiles} perfiles registrados`} accent="indigo" />
        <KpiCard label="Saldo wallets" value={formatMoney(counts.totalWalletBalanceCents, counts.primaryCurrency)} detail={`${formatMoney(counts.totalReservedCents, counts.primaryCurrency)} reservado`} accent="emerald" />
        <KpiCard label="Pagos por revisar" value={String(counts.pendingPayments)} detail="Manual / voucher pendiente" accent="amber" />
        <KpiCard label="Alertas operativas" value={String(priorityTotal)} detail={`${counts.openTickets} tickets, ${counts.failedWebhooks} webhooks fallidos`} accent="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="admin-data-panel p-5" tone="soft">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Flujo financiero</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[#061925]">Pagos recientes</h2>
              <p className="text-sm text-[#587080]">Incluye manuales y proveedores externos.</p>
            </div>
            <Link href="/admin/payments" className="rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1.5 text-xs font-black text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]">Ver pagos</Link>
          </div>
          <TableWrap>
            <Table>
              <thead><tr><Th>Pago</Th><Th>Cliente</Th><Th>Monto</Th><Th>Estado</Th></tr></thead>
              <tbody className="divide-y divide-[#e1edf2]">
                {data.recentPayments.map(({ row, organization }) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-[#f1fff8]/70">
                    <Td><Link href={`/admin/payments/${row.id}`} className="font-black text-[#061925] hover:text-[#0e7490]">{row.id.slice(0, 8)}</Link><p className="text-xs text-[#789bad]">{formatDateTime(row.created_at)}</p></Td>
                    <Td>{organization?.name ?? "—"}<p className="text-xs text-[#789bad]">{row.provider}</p></Td>
                    <Td className="font-black text-[#061925]">{formatMoney(row.amount_cents, row.currency)}</Td>
                    <Td><StatusBadge status={row.status} label={PAYMENT_STATUS_LABELS[row.status] ?? row.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="admin-data-panel p-5" tone="soft">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Soporte vivo</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-[#061925]">Tickets recientes</h2>
              <p className="text-sm text-[#587080]">Conversaciones reales desde el chat cliente.</p>
            </div>
            <Link href="/admin/support" className="rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1.5 text-xs font-black text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]">Ver soporte</Link>
          </div>
          <TableWrap>
            <Table>
              <thead><tr><Th>Ticket</Th><Th>Cliente</Th><Th>Prioridad</Th><Th>Estado</Th></tr></thead>
              <tbody className="divide-y divide-[#e1edf2]">
                {data.recentTickets.map(({ row, organization, requester }) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-[#f1fff8]/70">
                    <Td><Link href={`/admin/support/${row.id}`} className="font-black text-[#061925] hover:text-[#0e7490]">{row.subject}</Link><p className="text-xs text-[#789bad]">{formatDateTime(row.updated_at ?? row.created_at)}</p></Td>
                    <Td>{organization?.name ?? "—"}<p className="text-xs text-[#789bad]">{requester?.email ?? "—"}</p></Td>
                    <Td className="font-bold capitalize">{row.priority}</Td>
                    <Td><StatusBadge status={row.status} label={TICKET_STATUS_LABELS[row.status] ?? row.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>

      <Card className="admin-audit-panel mt-6 p-5" tone="premium">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Trazabilidad</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#061925]">Última actividad auditada</h2>
          </div>
          <Link href="/admin/audit" className="rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1.5 text-xs font-black text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]">Ver todo</Link>
        </div>
        <div className="mt-4 grid gap-3">
          {data.recentAudit.map(({ row, organization, actor }) => (
            <div key={row.id} className="relative rounded-2xl border border-[#dbeaf0] bg-white/[0.68] p-4 pl-5 transition-colors hover:bg-white/[0.86]">
              <span className="absolute left-0 top-5 h-8 w-1 rounded-r-full bg-[#74d3b4]" aria-hidden />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-[#061925]">{row.action}</p>
                <span className="text-xs font-bold text-[#789bad]">{formatDateTime(row.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-[#587080]">{organization?.name ?? "Sistema"} · {actor?.email ?? "Backend/service role"} · {row.entity_type}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
