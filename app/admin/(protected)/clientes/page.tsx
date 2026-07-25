import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { listClients } from "@/lib/admin/data";
import { formatMoney } from "@/lib/format";

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
    <>
      <AdminPageHeader
        eyebrow="Operación"
        title="Elegir cliente"
        description="Seleccioná un cliente y mirá solo lo suyo: wallet, cuentas, campañas y gasto. Nada se mezcla entre Ely, Luis u otros."
      />

      <Card className="mb-5 border-[var(--admin-accent)]/25 bg-[linear-gradient(135deg,var(--admin-accent-soft),transparent)] p-5">
        <p className="text-sm font-semibold text-[var(--admin-text)]">
          Flujo para demo / día a día
        </p>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
          1) Elegí cliente → 2) Entrá a su vista → 3) Mostrás: “esto es lo único que ve al
          entrar con su correo”. Los datos ya vienen de tu operación; no hace falta conectar
          TikTok acá por ahora.
        </p>
      </Card>

      <Card className="mb-5 p-5">
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
          <p className="text-sm text-[var(--admin-text-muted)]">
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
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--admin-accent-soft)] text-sm font-bold text-[var(--admin-accent)]">
                    {displayInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-[var(--admin-text)]">
                        {contactName}
                      </h2>
                      <StatusBadge status={client.organization.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--admin-text-muted)]">
                      {client.organization.name}
                      {client.primaryContact?.email ? ` · ${client.primaryContact.email}` : ""}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2">
                    <dt className="text-[11px] text-[var(--admin-text-muted)]">Wallet</dt>
                    <dd className="font-semibold text-[var(--admin-text)]">
                      {formatMoney(client.walletBalanceCents, client.walletCurrency)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2">
                    <dt className="text-[11px] text-[var(--admin-text-muted)]">Cuentas ads</dt>
                    <dd className="font-semibold text-[var(--admin-text)]">{client.adAccountCount}</dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <Badge tone="info">
                    {client.activeMemberCount} miembro
                    {client.activeMemberCount === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="mt-5">
                  <Button
                    asChild
                    href={`/admin/clientes/${client.organization.id}`}
                    className="h-11 w-full text-[14px] font-semibold"
                  >
                    Elegir este cliente
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
