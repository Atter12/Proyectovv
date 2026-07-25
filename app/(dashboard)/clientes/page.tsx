import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { requireSession } from "@/lib/auth/guards.server";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/data";
import { formatMoney } from "@/lib/format";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect(routes.overview);
  }

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const clients = await listClients({ q, status });

  const filtered = q
    ? clients.filter((client) => {
        const haystack = [
          client.organization.name,
          client.organization.slug,
          client.primaryContact?.full_name,
          client.primaryContact?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q.trim().toLowerCase());
      })
    : clients;

  return (
    <div className={dashboardClasses.page}>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          Operación
        </p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Elegir cliente
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--admin-text-muted,#64748b)]">
          Seleccioná un cliente y mirá solo lo suyo: wallet, cuentas, campañas y gasto. Nada se
          mezcla entre Ely, Luis u otros.
        </p>
      </div>

      <Card className="border-[var(--brand-primary)]/20 bg-[linear-gradient(135deg,rgb(23_139_255_/_0.06),transparent)] p-5">
        <p className="text-sm font-semibold text-[var(--foreground)]">Cómo usarlo</p>
        <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
          1) Elegí cliente → 2) Entrá a su vista → 3) Mostrás: “esto es lo único que ve al entrar
          con su correo”.
        </p>
      </Card>

      <Card className="p-5">
        <form className="grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar cliente… (ej. Ely Aguirre, Luis Vargas)"
          />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
            <option value="archived">Archivados</option>
          </Select>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-[var(--admin-text-muted,#64748b)]">
            No hay clientes con ese filtro. Cuando existan orgs (Luis, Ely, etc.) aparecen aquí.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => {
            const contactName =
              client.primaryContact?.full_name?.trim() ||
              client.primaryContact?.email ||
              client.organization.name;
            const displayInitials = initials(contactName) || "CL";

            return (
              <Card key={client.organization.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--brand-primary)]/10 text-sm font-bold text-[var(--brand-primary)]">
                    {displayInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-[var(--foreground)]">
                      {contactName}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-[var(--admin-text-muted,#64748b)]">
                      {client.organization.name}
                      {client.primaryContact?.email
                        ? ` · ${client.primaryContact.email}`
                        : ""}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
                    <dt className="text-[11px] text-[var(--admin-text-muted,#64748b)]">Wallet</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {formatMoney(client.walletBalanceCents, client.walletCurrency)}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
                    <dt className="text-[11px] text-[var(--admin-text-muted,#64748b)]">
                      Cuentas ads
                    </dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {client.adAccountCount}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <Badge variant="info">
                    {client.activeMemberCount} miembro
                    {client.activeMemberCount === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="mt-5">
                  <Link
                    href={`/clientes/${client.organization.id}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)]"
                  >
                    Elegir este cliente
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
