import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { AdAccountsPageHeader } from "@/features/ad-accounts/components/AdAccountsPageHeader";
import { AdAccountsMobileStickyCta } from "@/features/ad-accounts/components/AdAccountsMobileStickyCta.client";
import { AdAccountsTable } from "@/features/ad-accounts/components/AdAccountsTable";
import { AdAccountsToolbar } from "@/features/ad-accounts/components/AdAccountsToolbar.client";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { requirePermission } from "@/lib/auth/guards.server";
import { filterAdAccounts } from "@/lib/filter/ad-accounts";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getSearchParam } from "@/lib/search-params";
import { routes } from "@/config/routes";
import type { AdAccountStatus } from "@/types/ad-account";
import Link from "next/link";
import { Suspense } from "react";

interface AdAccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ACCOUNT_STATUSES = new Set<AdAccountStatus>([
  "active",
  "pending",
  "disabled",
  "review",
  "archived",
]);

function resolveAccountStatusFilter(raw: string): string {
  if (raw === "all" || ACCOUNT_STATUSES.has(raw as AdAccountStatus)) return raw;
  return "all";
}

export default async function AdAccountsPage({ searchParams }: AdAccountsPageProps) {
  const session = await requirePermission("adAccounts:read");
  const params = await searchParams;
  const search = getSearchParam(params, "q");
  const status = resolveAccountStatusFilter(getSearchParam(params, "status", "all"));
  const includeArchived = getSearchParam(params, "archived") === "1";
  void includeArchived;

  const selected = await getSelectedHecomCliente(session.id);

  if (!selected) {
    return (
      <div className={`${dashboardClasses.page} pb-24 md:pb-0`}>
        <AdAccountsPageHeader
          summary={{
            totalAccounts: 0,
            activeAccounts: 0,
            assignedBalance: 0,
            pendingSetup: 0,
            disabledAccounts: 0,
          }}
          hecomScoped={false}
          hideCreate
        />
        <PickClienteEmpty section="las cuentas publicitarias" mode="staff" />
      </div>
    );
  }

  const data = await getHecomClienteAdAccountsOverview(selected.id);
  const clienteName = data.cliente?.name ?? selected.name;
  const filteredAccounts = filterAdAccounts(data.accounts, { search, status });

  return (
    <div className={`${dashboardClasses.page} pb-24 md:pb-0`}>
      <AdAccountsPageHeader
        summary={data.summary}
        hecomScoped
        clienteName={clienteName}
        clienteId={selected.id}
        avatarUrl={data.cliente?.avatarUrl}
        hideCreate
      />

      <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
        <div className="border-b border-[var(--auth-divider)] px-5 py-4 sm:px-6">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
            Listado
          </p>
          <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            Advertisers de {clienteName}
          </h2>
          <p className="mt-1 text-[13px] font-medium text-[var(--auth-text-muted)]">
            Filtrá por nombre o estado. Solo lectura.
          </p>
        </div>
        <Suspense fallback={null}>
          <AdAccountsToolbar
            initialSearch={search}
            initialStatus={status}
            initialIncludeArchived={false}
            hideCreate
          />
        </Suspense>
        {filteredAccounts.length === 0 && data.accounts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#16161a] text-[9px] font-bold tracking-wide">
              <span className="text-[#25f4ee]">T</span>
              <span className="text-[#fe2c55]">T</span>
            </div>
            <p className="mt-4 text-[14px] font-medium tracking-[-0.01em] text-[var(--auth-text)]">
              {clienteName} no tiene cuentas TikTok para operar
            </p>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-5 text-[var(--auth-text-muted)]">
              Buscamos primero por{" "}
              <code className="rounded bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[12px] text-[var(--auth-accent)]">
                advertiser_id
              </code>{" "}
              en Hecom (activas y suspendidas) y, si falta el ID, por nombre en el
              BM. Si no aparece nada, no hay mapeo en Hecom ni coincidencia de
              nombre con “{clienteName}”.
            </p>
            <Link
              href={routes.payments}
              className="mt-5 inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
            >
              Ir a pagos para recargar
            </Link>
          </div>
        ) : (
          <AdAccountsTable accounts={filteredAccounts} readOnly />
        )}
      </section>
      <AdAccountsMobileStickyCta hideCreate />
    </div>
  );
}
