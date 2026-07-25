import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KpiCard } from "@/components/admin/KpiCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { ClientAccessInvitePanel } from "@/features/admin/components/ClientAccessInvitePanel.client";
import { getClientVista } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClienteVistaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vista = await getClientVista(id);
  if (!vista) notFound();

  const contactName =
    vista.primaryContact?.full_name?.trim() ||
    vista.primaryContact?.email ||
    vista.organization.name;
  const currency = vista.summary.currency;

  return (
    <>
      <AdminPageHeader
        eyebrow="Vista del cliente"
        title={contactName}
        description={`Así vería ${contactName} al entrar a Ecomdy. Solo datos de “${vista.organization.name}” — aislado del resto de clientes.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/clientes"
              className="text-sm font-semibold text-[var(--admin-accent)] hover:text-[var(--admin-accent-hover)]"
            >
              ← Clientes
            </Link>
            <Link
              href={`/admin/organizations/${vista.organization.id}`}
              className="text-sm font-medium text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]"
            >
              Ficha operativa
            </Link>
          </div>
        }
      />

      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-semibold">Modo demo / soporte · solo lectura</p>
        <p className="mt-1 opacity-90">
          No estás logueado como el cliente: estás viendo su panel desde admin. Ideal para
          mostrarle a tu jefe: “si entra Ely, ve solo esto”.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Saldo wallet"
          value={formatMoney(vista.summary.walletBalanceCents, currency)}
          detail={vista.wallet?.name ?? "Cartera"}
          accent="emerald"
        />
        <KpiCard
          label="Gasto hoy"
          value={formatMoney(vista.summary.todaySpendCents, currency)}
          detail={`${formatMoney(vista.summary.spend30dCents, currency)} en 30 días`}
          accent="amber"
        />
        <KpiCard
          label="Cuentas ads"
          value={String(vista.summary.totalAdAccounts)}
          detail={`${vista.summary.activeAdAccounts} activas`}
          accent="indigo"
        />
        <KpiCard
          label="Campañas"
          value={String(Math.max(vista.summary.totalCampaigns, vista.campaigns.length))}
          detail={
            vista.tiktok.connected
              ? "TikTok conectado"
              : "TikTok sin conectar · sync campañas en progreso"
          }
          accent="rose"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">
                Sus cuentas publicitarias
              </h2>
              <Badge tone="info">Solo de este cliente</Badge>
            </div>
            {vista.adAccounts.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-text-muted)]">
                Aún no tiene cuentas. Cuando conecte TikTok o cree una manual, aparecen aquí.
              </p>
            ) : (
              <TableWrap className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Cuenta</Th>
                      <Th>Plataforma</Th>
                      <Th>Saldo asignado</Th>
                      <Th>Estado</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-table-divider)]">
                    {vista.adAccounts.map((account) => (
                      <tr key={account.id}>
                        <Td>
                          <p className="font-semibold text-[var(--admin-text)]">{account.name}</p>
                          <p className="text-xs text-[var(--admin-text-muted)]">
                            {account.external_account_id ?? "manual"}
                          </p>
                        </Td>
                        <Td className="font-bold uppercase">{account.platform}</Td>
                        <Td className="font-semibold">
                          {formatMoney(account.availableBalanceCents, account.currency)}
                        </Td>
                        <Td>
                          <StatusBadge status={account.status} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">Campañas</h2>
              <Badge tone={vista.campaigns.length > 0 ? "success" : "neutral"}>
                {vista.campaigns.length} en base
              </Badge>
            </div>
            {vista.campaigns.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-text-muted)]">
                Todavía no hay campañas sincronizadas para este cliente. El schema está listo;
                cuando corra el sync de TikTok a nivel campaña, se listan acá (solo las suyas).
              </p>
            ) : (
              <TableWrap className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Campaña</Th>
                      <Th>Presupuesto / día</Th>
                      <Th>Estado</Th>
                      <Th>Creada</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-table-divider)]">
                    {vista.campaigns.map((campaign) => (
                      <tr key={campaign.id}>
                        <Td className="font-semibold text-[var(--admin-text)]">{campaign.name}</Td>
                        <Td>
                          {formatMoney(campaign.daily_budget_cents, campaign.currency)}
                        </Td>
                        <Td>
                          <StatusBadge status={campaign.status} />
                        </Td>
                        <Td>{formatDateTime(campaign.created_at)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <ClientAccessInvitePanel
            organizationId={vista.organization.id}
            clientLabel={contactName}
            initialInvites={vista.emailInvites}
          />

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Conexión TikTok</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--admin-text-muted)]">Estado</span>
                <Badge tone={vista.tiktok.connected ? "success" : "warning"}>
                  {vista.tiktok.connected ? "Conectado" : "Sin conectar"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--admin-text-muted)]">Último sync</span>
                <span className="font-medium text-[var(--admin-text)]">
                  {vista.tiktok.lastSyncedAt
                    ? formatDateTime(vista.tiktok.lastSyncedAt)
                    : "—"}
                </span>
              </div>
              <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2 text-xs text-[var(--admin-text-muted)]">
                La conexión OAuth vive en esta organización. Luis no ve el TikTok de Ely, ni al
                revés.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Quién entra aquí</h2>
            <ul className="mt-4 space-y-3">
              {vista.members
                .filter((member) => member.row.status === "active")
                .map(({ row, profile }) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-2 border-b border-[var(--admin-border)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--admin-text)]">
                        {profile?.full_name ?? profile?.email ?? row.user_id}
                      </p>
                      <p className="truncate text-xs text-[var(--admin-text-muted)]">
                        {profile?.email}
                      </p>
                    </div>
                    <Badge tone="purple">{row.role}</Badge>
                  </li>
                ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Pagos recientes</h2>
            {vista.recentPayments.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-text-muted)]">Sin pagos aún.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {vista.recentPayments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-2 border-b border-[var(--admin-border)] py-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium capitalize text-[var(--admin-text)]">
                        {payment.provider}
                      </p>
                      <p className="text-xs text-[var(--admin-text-muted)]">
                        {formatDateTime(payment.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatMoney(payment.amount_cents, payment.currency)}
                      </p>
                      <StatusBadge status={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
