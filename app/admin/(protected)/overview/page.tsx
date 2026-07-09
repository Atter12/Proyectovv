import Link from "next/link";
import { PaymentFlowChart } from "@/components/admin/charts/PaymentFlowChart.client";
import { adminPanelTypography } from "@/components/admin/overview/adminPanelTypography";
import { WalletExposureRanking } from "@/components/admin/overview/WalletExposureRanking";
import { AdminExecutiveOverview } from "@/components/admin/overview/AdminExecutiveOverview";
import { AdminOverviewHeader } from "@/components/admin/overview/AdminOverviewHeader";
import { buildOverviewMetrics } from "@/components/admin/overview/buildOverviewMetrics";
import { paymentOverviewActionClass, paymentOverviewActionLabel } from "@/components/admin/overview/overviewActions";
import { RecentAuditFeed, RecentAuditFeedHeaderLink } from "@/components/admin/overview/RecentAuditFeed";
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
        <div className="mb-3">
          <p className={adminPanelTypography.sectionEyebrow}>Tendencia financiera</p>
          <h2 className={adminPanelTypography.sectionTitle}>Flujo de pagos</h2>
          <p className={adminPanelTypography.sectionSubtitle}>
            Pagos creados, aprobados y pendientes según el rango seleccionado.
          </p>
        </div>
        <PaymentFlowChart data={analytics.paymentFlow} currency={analytics.primaryCurrency} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="admin-data-panel p-4 sm:p-5" tone="soft">
          <div className="mb-3">
            <p className={adminPanelTypography.sectionEyebrow}>Exposición financiera</p>
            <h2 className={adminPanelTypography.sectionTitle}>Top wallets por organización</h2>
            <p className={adminPanelTypography.sectionSubtitle}>
              Saldos activos y concentración por organización.
            </p>
          </div>
          <WalletExposureRanking data={analytics.walletExposure} currency={analytics.primaryCurrency} />
        </Card>

        <Card className="admin-data-panel p-4 sm:p-5" tone="soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={adminPanelTypography.sectionEyebrow}>Flujo operativo</p>
              <h2 className={adminPanelTypography.sectionTitle}>Pagos recientes</h2>
              <p className={adminPanelTypography.sectionSubtitle}>
                Últimos pagos manuales y externos para revisión.
              </p>
            </div>
            <Link href="/admin/payments" className="shrink-0 rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]">Ver pagos</Link>
          </div>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Pago</Th>
                  <Th>Cliente</Th>
                  <Th>Monto</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acción</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e1edf2]">
                {data.recentPayments.map(({ row, organization }) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-[#f1fff8]/70">
                    <Td className="py-3">
                      <Link href={`/admin/payments/${row.id}`} className="font-black text-[#061925] hover:text-[#0e7490]">
                        {row.id.slice(0, 8)}
                      </Link>
                      <p className="text-xs text-[#789bad]">{formatDateTime(row.created_at)}</p>
                    </Td>
                    <Td className="py-3">
                      <p className="max-w-[8rem] truncate" title={organization?.name ?? undefined}>
                        {organization?.name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-[#789bad]">{row.provider}</p>
                    </Td>
                    <Td className="whitespace-nowrap font-black text-[#061925]">{formatMoney(row.amount_cents, row.currency)}</Td>
                    <Td className="py-3">
                      <StatusBadge status={row.status} label={PAYMENT_STATUS_LABELS[row.status] ?? row.status} />
                    </Td>
                    <Td className="text-right">
                      <Link href={`/admin/payments/${row.id}`} className={paymentOverviewActionClass(row.status)}>
                        {paymentOverviewActionLabel(row.status)}
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="admin-data-panel p-4 sm:p-5" tone="soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={adminPanelTypography.sectionEyebrow}>Soporte</p>
              <h2 className={adminPanelTypography.sectionTitle}>Tickets recientes</h2>
              <p className={adminPanelTypography.sectionSubtitle}>Conversaciones recientes del chat con clientes.</p>
            </div>
            <Link href="/admin/support" className="shrink-0 rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]">Ver soporte</Link>
          </div>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Ticket</Th>
                  <Th>Cliente</Th>
                  <Th>Prioridad</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acción</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e1edf2]">
                {data.recentTickets.map(({ row, organization, requester }) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-[#f1fff8]/70">
                    <Td className="py-3">
                      <p className="max-w-[9rem] truncate font-black text-[#061925]" title={row.subject}>
                        {row.subject}
                      </p>
                      <p className="text-xs text-[#789bad]">{formatDateTime(row.updated_at ?? row.created_at)}</p>
                    </Td>
                    <Td className="py-3">
                      <p className="max-w-[7rem] truncate" title={organization?.name ?? undefined}>
                        {organization?.name ?? "—"}
                      </p>
                      <p className="max-w-[7rem] truncate text-xs text-[#789bad]" title={requester?.email ?? undefined}>
                        {requester?.email ?? "—"}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap font-bold capitalize">{row.priority}</Td>
                    <Td className="py-3">
                      <StatusBadge status={row.status} label={TICKET_STATUS_LABELS[row.status] ?? row.status} />
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/support/${row.id}`}
                        className="inline-flex rounded-md border border-[#cfe8ee] bg-white/80 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.06em] text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]"
                      >
                        Abrir
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="admin-data-panel p-4 sm:p-5" tone="soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={adminPanelTypography.sectionEyebrow}>Trazabilidad</p>
              <h2 className={adminPanelTypography.sectionTitle}>Última actividad auditada</h2>
              <p className={adminPanelTypography.sectionSubtitle}>Registro reciente de acciones del sistema.</p>
            </div>
            <RecentAuditFeedHeaderLink />
          </div>
          <RecentAuditFeed items={data.recentAudit} />
        </Card>
      </div>
    </>
  );
}
