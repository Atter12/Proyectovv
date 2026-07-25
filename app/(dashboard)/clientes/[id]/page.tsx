import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { routes } from "@/config/routes";
import {
  getHecomCliente,
  listHecomClienteSpend,
} from "@/lib/hecom/clientes.server";
import { getHecomSupabaseConfig } from "@/lib/hecom/supabase.server";
import { requireSession } from "@/lib/auth/guards.server";
import { formatDateTime } from "@/lib/format";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { SelectHecomClienteOnMount } from "@/features/clientes/components/SelectHecomClienteOnMount.client";

export const dynamic = "force-dynamic";

function moneyUsd(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function ClienteVistaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const hecomCfg = getHecomSupabaseConfig();

  console.log("[Clientes/detalle] load Hecom", {
    id,
    hecomConfigured: hecomCfg.configured,
    hecomUrl: hecomCfg.url,
  });

  let loadError: string | null = null;
  let cliente: Awaited<ReturnType<typeof getHecomCliente>> = null;
  let spend: Awaited<ReturnType<typeof listHecomClienteSpend>> = {
    kind: "none",
    rows: [],
  };

  try {
    cliente = await getHecomCliente(id);
    if (cliente && hecomCfg.configured) {
      spend = await listHecomClienteSpend(id, 40);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Error cargando cliente Hecom";
    console.error("[Clientes/detalle] ERROR", loadError, error);
  }

  if (!loadError && !cliente) {
    notFound();
  }

  if (loadError || !cliente) {
    return (
      <div className={dashboardClasses.page}>
        <Card className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-950">
          <p className="font-semibold">No se pudo abrir este cliente Hecom</p>
          <p className="mt-2">{loadError}</p>
          <Link
            href={routes.clientes}
            className="mt-4 inline-flex text-sm font-semibold text-[var(--brand-primary)]"
          >
            ← Volver a Clientes
          </Link>
        </Card>
      </div>
    );
  }

  const primaryEmail = cliente.emails[0] ?? null;
  const accounts =
    cliente.tiktokAccounts.length > 0
      ? cliente.tiktokAccounts
      : cliente.tiktokAdvertiserId
        ? [
            {
              advertiserId: cliente.tiktokAdvertiserId,
              advertiserName: cliente.tiktokAdvertiserName,
              bmBucket: null as string | null,
              fee: cliente.tiktokDefaultFee,
              syncEnabled: cliente.tiktokSyncEnabled !== false,
            },
          ]
        : [];

  const spendTotal = spend.rows.reduce((acc, row) => {
    const key = spend.kind === "gastos" ? "monto" : "spend";
    const n = Number(row[key]);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

  return (
    <div className={dashboardClasses.page}>
      <SelectHecomClienteOnMount clienteId={cliente.id} name={cliente.name} />
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Hecom Club · Cliente
            </p>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              {cliente.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--admin-text-muted,#64748b)]">
              {cliente.biz ? `${cliente.biz} · ` : ""}
              {primaryEmail ?? "Sin email"}
              {cliente.dni ? ` · DNI ${cliente.dni}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href={routes.clientes}
              className="text-sm font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-deep)]"
            >
              ← Elegir otro cliente
            </Link>
            <Link
              href={routes.adAccounts}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[var(--brand-primary-deep)]"
            >
              Ver sus cuentas publicitarias
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-semibold">Cliente seleccionado</p>
        <p className="mt-1 opacity-90">
          {hecomCfg.configured
            ? "Fuente live: Supabase Hecom Club."
            : "Fuente: backup Holistic local (sin HECOM_SUPABASE_SERVICE_ROLE_KEY aún)."}{" "}
          En <strong>Mis cuentas publicitarias</strong> solo vas a ver lo de{" "}
          {cliente.name}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Cuentas TikTok
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {accounts.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Emails CRM
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {cliente.emails.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Filas gasto (vista)
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {spend.rows.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
            Suma en lista
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">
            {moneyUsd(spendTotal)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Cuentas TikTok Ads
              </h2>
              <Badge variant="info">cliente_tiktok_cuentas</Badge>
            </div>
            {accounts.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
                Este cliente aún no tiene advertiser_id mapeado en Hecom.
              </p>
            ) : (
              <TableWrap className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Advertiser</Th>
                      <Th>BM</Th>
                      <Th>Fee</Th>
                      <Th>Sync</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {accounts.map((account) => (
                      <tr key={account.advertiserId}>
                        <Td>
                          <p className="font-semibold text-[var(--foreground)]">
                            {account.advertiserName ?? "TikTok Ads"}
                          </p>
                          <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                            {account.advertiserId}
                          </p>
                        </Td>
                        <Td>{account.bmBucket ?? "—"}</Td>
                        <Td>
                          {account.fee != null ? `${account.fee}%` : "—"}
                        </Td>
                        <Td>
                          <Badge variant={account.syncEnabled ? "info" : "neutral"}>
                            {account.syncEnabled ? "on" : "off"}
                          </Badge>
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
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Gastos / snapshots
              </h2>
              <Badge variant="neutral">
                {spend.kind === "snapshots"
                  ? "tiktok_spend_snapshots"
                  : spend.kind === "gastos"
                    ? "gastos"
                    : "sin datos"}
              </Badge>
            </div>
            {spend.rows.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
                No hay filas de gasto para este cliente en Hecom (o la sync aún no corrió).
              </p>
            ) : (
              <TableWrap className="mt-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>Fecha</Th>
                      <Th>Detalle</Th>
                      <Th>Monto</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {spend.rows.map((row) => {
                      const rowId = String(row.id ?? Math.random());
                      if (spend.kind === "gastos") {
                        return (
                          <tr key={rowId}>
                            <Td>{String(row.fecha ?? "—")}</Td>
                            <Td>
                              <p className="font-semibold">{String(row.camp ?? "Gasto")}</p>
                              <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                                {String(row.source ?? "")}
                              </p>
                            </Td>
                            <Td className="font-semibold">{moneyUsd(row.monto)}</Td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={rowId}>
                          <Td>{String(row.stat_date ?? "—")}</Td>
                          <Td>
                            <p className="font-semibold">
                              {String(row.campaign_name ?? row.advertiser_id ?? "Spend")}
                            </p>
                            <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                              {row.created_at
                                ? formatDateTime(String(row.created_at))
                                : ""}
                            </p>
                          </Td>
                          <Td className="font-semibold">{moneyUsd(row.spend)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Contacto CRM</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {cliente.emails.length === 0 ? (
                <li className="text-[var(--admin-text-muted,#64748b)]">Sin emails</li>
              ) : (
                cliente.emails.map((email) => (
                  <li key={email} className="font-medium text-[var(--foreground)]">
                    {email}
                  </li>
                ))
              )}
            </ul>
            {cliente.phones.length > 0 ? (
              <ul className="mt-4 space-y-1 text-sm text-[var(--admin-text-muted,#64748b)]">
                {cliente.phones.map((phone) => (
                  <li key={phone}>{phone}</li>
                ))}
              </ul>
            ) : null}
            {cliente.notes ? (
              <p className="mt-4 text-sm text-[var(--admin-text-muted,#64748b)]">
                {cliente.notes}
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Cómo se jala el gasto</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--admin-text-muted,#64748b)]">
              <li>
                En Hecom hay un solo token de agencia:{" "}
                <code className="rounded bg-[var(--surface-soft)] px-1">TIKTOK_ACCESS_TOKEN</code>.
              </li>
              <li>
                Cada cliente tiene uno o más{" "}
                <code className="rounded bg-[var(--surface-soft)] px-1">advertiser_id</code>.
              </li>
              <li>Sync escribe snapshots / gastos; acá solo leemos lo ya guardado.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
