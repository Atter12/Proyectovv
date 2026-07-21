import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { KpiCard } from "@/components/admin/KpiCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { getOrganizationDetail } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOrganizationDetail(id);
  if (!detail) notFound();
  const wallet = detail.wallets[0];
  const totalPayments = detail.payments.reduce((sum, payment) => sum + (payment.status === "succeeded" ? payment.amount_cents : 0), 0);

  return (
    <>
      <AdminPageHeader
        eyebrow="Ficha cliente"
        title={detail.row.name}
        description={`${detail.row.slug} · creada ${formatDateTime(detail.row.created_at)} · ${detail.createdByProfile?.email ?? "sin owner detectado"}`}
        actions={<Link href="/admin/organizations" className="text-sm font-semibold text-[var(--admin-accent)] hover:text-[var(--admin-accent-hover)]">← Volver</Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Saldo wallet" value={wallet ? formatMoney(wallet.balance_cents, wallet.currency) : "—"} detail={wallet ? `${formatMoney(wallet.reserved_balance_cents ?? 0, wallet.currency)} reservado` : "sin cartera"} accent="emerald" />
        <KpiCard label="Pagos aprobados" value={formatMoney(totalPayments, wallet?.currency ?? "USD")} detail={`${detail.payments.length} pagos recientes`} accent="indigo" />
        <KpiCard label="Cuentas Ads" value={String(detail.adAccounts.length)} detail={`${detail.adAccounts.filter((account) => account.status === "active").length} activas`} accent="amber" />
        <KpiCard label="Soporte" value={String(detail.tickets.length)} detail={`${detail.tickets.filter((ticket) => ["open", "pending"].includes(ticket.status)).length} abiertos`} accent="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Miembros</h2>
            <TableWrap className="mt-4">
              <Table>
                <thead><tr><Th>Usuario</Th><Th>Rol</Th><Th>Estado</Th><Th>Default</Th></tr></thead>
                <tbody className="divide-y divide-[#e4eef3]">
                  {detail.memberships.map(({ row, profile }) => (
                    <tr key={row.id}>
                      <Td><p className="font-semibold text-[var(--admin-text)]">{profile?.full_name ?? profile?.email ?? row.user_id}</p><p className="text-xs text-[var(--admin-text-muted)]">{profile?.email}</p></Td>
                      <Td><Badge tone="purple">{row.role}</Badge></Td>
                      <Td><StatusBadge status={row.status} /></Td>
                      <Td>{row.is_default ? "Sí" : "No"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Actividad financiera reciente</h2>
            <TableWrap className="mt-4">
              <Table>
                <thead><tr><Th>Fuente</Th><Th>Monto</Th><Th>Estado</Th><Th>Fecha</Th></tr></thead>
                <tbody className="divide-y divide-[#e4eef3]">
                  {detail.payments.slice(0, 8).map((payment) => (
                    <tr key={payment.id}>
                      <Td><Link href={`/admin/payments/${payment.id}`} className="font-semibold text-[var(--admin-text)] hover:text-[var(--admin-accent)]">{payment.provider}</Link><p className="text-xs text-[var(--admin-text-muted)]">{payment.id}</p></Td>
                      <Td className="font-semibold text-[var(--admin-text)]">{formatMoney(payment.amount_cents, payment.currency)}</Td>
                      <Td><StatusBadge status={payment.status} /></Td>
                      <Td>{formatDateTime(payment.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Cuentas publicitarias</h2>
            <TableWrap className="mt-4">
              <Table>
                <thead><tr><Th>Cuenta</Th><Th>Plataforma</Th><Th>Presupuesto</Th><Th>Estado</Th></tr></thead>
                <tbody className="divide-y divide-[#e4eef3]">
                  {detail.adAccounts.map((account) => (
                    <tr key={account.id}>
                      <Td><p className="font-semibold text-[var(--admin-text)]">{account.name}</p><p className="text-xs text-[var(--admin-text-muted)]">{account.external_account_id ?? "manual"}</p></Td>
                      <Td className="font-bold uppercase">{account.platform}</Td>
                      <Td>{formatMoney(account.daily_budget_cents, account.currency)} / día</Td>
                      <Td><StatusBadge status={account.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Datos legales</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-semibold text-[var(--admin-text-muted)]">Razón social</dt><dd className="font-bold text-[var(--admin-text)]">{detail.row.legal_name ?? "—"}</dd></div>
              <div><dt className="font-semibold text-[var(--admin-text-muted)]">Tax ID</dt><dd className="font-bold text-[var(--admin-text)]">{detail.row.tax_id ?? "—"}</dd></div>
              <div><dt className="font-semibold text-[var(--admin-text-muted)]">Billing email</dt><dd className="font-bold text-[var(--admin-text)]">{detail.row.billing_email ?? "—"}</dd></div>
              <div><dt className="font-semibold text-[var(--admin-text-muted)]">País</dt><dd className="font-bold text-[var(--admin-text)]">{detail.row.country ?? "—"}</dd></div>
            </dl>
          </Card>
          <JsonPreview title="Metadata organización" value={detail.row.metadata} />
        </div>
      </div>
    </>
  );
}
