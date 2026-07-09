import Link from "next/link";
import { PaymentFlowChart } from "@/components/admin/charts/PaymentFlowChart.client";
import { WalletExposureRanking } from "@/components/admin/overview/WalletExposureRanking";
import { AdminExecutiveOverview } from "@/components/admin/overview/AdminExecutiveOverview";
import { AdminOverviewHeader } from "@/components/admin/overview/AdminOverviewHeader";
import { buildOverviewMetrics } from "@/components/admin/overview/buildOverviewMetrics";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { getOverviewAnalyticsData, getOverviewData } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PAYMENT_STATUS_LABELS, TICKET_STATUS_LABELS } from "@/lib/constants/status";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [data, analytics] = await Promise.all([getOverviewData(), getOverviewAnalyticsData()]);
  const { counts } = data;
  const priorityTotal = counts.pendingPayments + counts.pendingRefunds + counts.openTickets + counts.failedWebhooks;
  const metrics = buildOverviewMetrics(counts, priorityTotal);

  return (
    <>
      <AdminOverviewHeader />

      <AdminExecutiveOverview
        metrics={metrics}
        priorityTotal={priorityTotal}
        counts={counts}
        operationalProgress={analytics.operationalProgress}
      />

      <Card className="admin-data-panel p-5" tone="soft">
        <div className="mb-4">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Tendencia financiera</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-[#061925]">Flujo de pagos</h2>
          <p className="text-sm text-[#587080]">Intents creados, completados y pendientes por día · rango ajustable.</p>
        </div>
        <PaymentFlowChart data={analytics.paymentFlow} currency={analytics.primaryCurrency} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="admin-data-panel p-5" tone="soft">
          <div className="mb-3">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Exposición financiera</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-[#061925]">Top wallets por organización</h2>
            <p className="text-sm text-[#587080]">Concentración de saldo y exposición por cliente.</p>
          </div>
          <WalletExposureRanking data={analytics.walletExposure} currency={analytics.primaryCurrency} />
        </Card>

        <Card className="admin-data-panel p-5" tone="soft">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Flujo operativo</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-[#061925]">Pagos recientes</h2>
              <p className="text-sm text-[#587080]">Manuales y proveedores externos · acceso directo a la cola.</p>
            </div>
            <Link href="/admin/payments" className="shrink-0 rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1.5 text-xs font-black text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]">Ver pagos</Link>
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
      </div>

      <Card className="admin-data-panel mt-6 p-5" tone="soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Soporte vivo</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-[#061925]">Tickets recientes</h2>
            <p className="text-sm text-[#587080]">Conversaciones desde el chat cliente.</p>
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

      <Card className="admin-audit-panel mt-6 p-5" tone="premium">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#23718b]">Trazabilidad</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-[#061925]">Última actividad auditada</h2>
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
