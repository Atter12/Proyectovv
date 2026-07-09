import Link from "next/link";
import { PaymentFlowChart } from "@/components/admin/charts/PaymentFlowChart.client";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { WalletExposureRanking } from "@/components/admin/overview/WalletExposureRanking";
import { AdminExecutiveOverview } from "@/components/admin/overview/AdminExecutiveOverview";
import { AdminOverviewHeader } from "@/components/admin/overview/AdminOverviewHeader";
import { buildOverviewMetrics } from "@/components/admin/overview/buildOverviewMetrics";
import { paymentOverviewActionClass, paymentOverviewActionLabel } from "@/components/admin/overview/overviewActions";
import { RecentAuditFeed, RecentAuditFeedHeaderLink } from "@/components/admin/overview/RecentAuditFeed";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buttonClass } from "@/components/ui/Button";
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

      <Card className="admin-data-panel" tone="soft">
        <SectionHeader
          eyebrow="Tendencia financiera"
          title="Flujo de pagos"
          subtitle="Pagos creados, aprobados y pendientes según el rango seleccionado."
        />
        <PaymentFlowChart data={analytics.paymentFlow} currency={analytics.primaryCurrency} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="admin-data-panel" tone="soft">
          <SectionHeader
            eyebrow="Exposición financiera"
            title="Top wallets por organización"
            subtitle="Saldos activos y concentración por organización."
          />
          <WalletExposureRanking data={analytics.walletExposure} currency={analytics.primaryCurrency} />
        </Card>

        <Card className="admin-data-panel" tone="soft">
          <SectionHeader
            eyebrow="Flujo operativo"
            title="Pagos recientes"
            subtitle="Últimos pagos manuales y externos para revisión."
            actions={
              <Link href="/admin/payments" className={buttonClass("outline", "sm")}>
                Ver pagos
              </Link>
            }
          />
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
              <tbody className="divide-y divide-[var(--admin-table-divider)]">
                {data.recentPayments.map(({ row, organization }) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-[var(--admin-table-row-hover)]">
                    <Td className="align-middle py-2.5">
                      <Link href={`/admin/payments/${row.id}`} className="font-medium text-[var(--admin-text)] hover:text-[var(--admin-accent)]">
                        {row.id.slice(0, 8)}
                      </Link>
                      <p className="text-xs text-[var(--admin-text-muted)]">{formatDateTime(row.created_at)}</p>
                    </Td>
                    <Td className="align-middle py-2.5">
                      <p className="max-w-[8rem] truncate" title={organization?.name ?? undefined}>
                        {organization?.name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-[var(--admin-text-muted)]">{row.provider}</p>
                    </Td>
                    <Td className="align-middle whitespace-nowrap py-2.5 font-medium tabular-nums text-[var(--admin-text)]">
                      {formatMoney(row.amount_cents, row.currency)}
                    </Td>
                    <Td className="align-middle py-2.5">
                      <StatusBadge
                        status={row.status}
                        label={PAYMENT_STATUS_LABELS[row.status] ?? row.status}
                        className="!py-0.5 !text-[0.625rem] !font-medium !normal-case !tracking-normal"
                      />
                    </Td>
                    <Td className="align-middle py-2.5 text-right">
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

        <Card className="admin-data-panel" tone="soft">
          <SectionHeader
            eyebrow="Soporte"
            title="Tickets recientes"
            subtitle="Conversaciones recientes del chat con clientes."
            actions={
              <Link href="/admin/support" className={buttonClass("outline", "sm")}>
                Ver soporte
              </Link>
            }
          />
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
              <tbody className="divide-y divide-[var(--admin-table-divider)]">
                {data.recentTickets.map(({ row, organization, requester }) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-[var(--admin-table-row-hover)]">
                    <Td className="py-3">
                      <p className="max-w-[9rem] truncate font-medium text-[var(--admin-text)]" title={row.subject}>
                        {row.subject}
                      </p>
                      <p className="text-xs text-[var(--admin-text-muted)]">{formatDateTime(row.updated_at ?? row.created_at)}</p>
                    </Td>
                    <Td className="py-3">
                      <p className="max-w-[7rem] truncate" title={organization?.name ?? undefined}>
                        {organization?.name ?? "—"}
                      </p>
                      <p className="max-w-[7rem] truncate text-xs text-[var(--admin-text-muted)]" title={requester?.email ?? undefined}>
                        {requester?.email ?? "—"}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap font-medium capitalize text-[var(--admin-text-muted)]">{row.priority}</Td>
                    <Td className="py-3">
                      <StatusBadge status={row.status} label={TICKET_STATUS_LABELS[row.status] ?? row.status} />
                    </Td>
                    <Td className="text-right">
                      <Link href={`/admin/support/${row.id}`} className={buttonClass("outline", "sm", "h-7 px-2 text-xs")}>
                        Abrir
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="admin-data-panel" tone="soft">
          <SectionHeader
            eyebrow="Trazabilidad"
            title="Última actividad auditada"
            subtitle="Registro reciente de acciones del sistema."
            actions={<RecentAuditFeedHeaderLink />}
          />
          <RecentAuditFeed items={data.recentAudit} />
        </Card>
      </div>
    </>
  );
}
