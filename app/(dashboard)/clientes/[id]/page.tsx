import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { ClientAccessInvitePanel } from "@/features/admin/components/ClientAccessInvitePanel.client";
import { routes } from "@/config/routes";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getClientVista } from "@/lib/admin/data";
import { requireSession } from "@/lib/auth/guards.server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";

export const dynamic = "force-dynamic";

export default async function ClienteVistaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const admin = await getCurrentAdmin();
  if (!admin) redirect(routes.overview);

  const { id } = await params;
  const vista = await getClientVista(id);
  if (!vista) notFound();

  const contactName =
    vista.primaryContact?.full_name?.trim() ||
    vista.primaryContact?.email ||
    vista.organization.name;
  const currency = vista.summary.currency;

  return (
    <div className={dashboardClasses.page}>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Cliente seleccionado
            </p>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {contactName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--admin-text-muted,#64748b)]">
              Solo datos de “{vista.organization.name}”. Así vería al entrar con su correo.
            </p>
          </div>
          <Link
            href={routes.clientes}
            className="text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-deep)]"
          >
            ← Elegir otro cliente
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-semibold">Vista filtrada por cliente</p>
        <p className="mt-1 opacity-90">
          Estás viendo únicamente lo de {contactName}. Ideal para el video: “elige cliente → ve
          solo lo suyo”.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Saldo wallet
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {formatMoney(vista.summary.walletBalanceCents, currency)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Gasto hoy
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {formatMoney(vista.summary.todaySpendCents, currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
            {formatMoney(vista.summary.spend30dCents, currency)} en 30 días
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Cuentas ads
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {vista.summary.totalAdAccounts}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
            {vista.summary.activeAdAccounts} activas
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Campañas
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {Math.max(vista.summary.totalCampaigns, vista.campaigns.length)}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
            Solo de este cliente
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Sus cuentas publicitarias
              </h2>
              <Badge variant="info">Solo de este cliente</Badge>
            </div>
            {vista.adAccounts.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
                Aún no hay cuentas cargadas para este cliente.
              </p>
            ) : (
              <TableWrap className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Cuenta</Th>
                      <Th>Plataforma</Th>
                      <Th>Saldo</Th>
                      <Th>Estado</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {vista.adAccounts.map((account) => (
                      <tr key={account.id}>
                        <Td>
                          <p className="font-semibold text-[var(--foreground)]">{account.name}</p>
                          <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                            {account.external_account_id ?? "manual"}
                          </p>
                        </Td>
                        <Td className="font-bold uppercase">{account.platform}</Td>
                        <Td className="font-semibold">
                          {formatMoney(account.availableBalanceCents, account.currency)}
                        </Td>
                        <Td>
                          <Badge variant="neutral">{account.status}</Badge>
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
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Campañas</h2>
              <Badge variant={vista.campaigns.length > 0 ? "success" : "neutral"}>
                {vista.campaigns.length}
              </Badge>
            </div>
            {vista.campaigns.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
                Todavía no hay campañas listadas para este cliente. Cuando las jalen de tu
                sistema, aparecen acá filtradas solo para él.
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
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {vista.campaigns.map((campaign) => (
                      <tr key={campaign.id}>
                        <Td className="font-semibold">{campaign.name}</Td>
                        <Td>
                          {formatMoney(campaign.daily_budget_cents, campaign.currency)}
                        </Td>
                        <Td>
                          <Badge variant="neutral">{campaign.status}</Badge>
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
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Quién entra aquí</h2>
            <ul className="mt-4 space-y-3">
              {vista.members
                .filter((member) => member.row.status === "active")
                .map(({ row, profile }) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        {profile?.full_name ?? profile?.email ?? row.user_id}
                      </p>
                      <p className="truncate text-xs text-[var(--admin-text-muted,#64748b)]">
                        {profile?.email}
                      </p>
                    </div>
                    <Badge variant="purple">{row.role}</Badge>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
