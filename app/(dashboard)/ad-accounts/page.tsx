import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { Card } from "@/components/ui/Card";
import { AdAccountsPageHeader } from "@/features/ad-accounts/components/AdAccountsPageHeader";
import { AdAccountsInfoAlert } from "@/features/ad-accounts/components/AdAccountsInfoAlert";
import { AdAccountsMobileStickyCta } from "@/features/ad-accounts/components/AdAccountsMobileStickyCta.client";
import { AdAccountsPickClienteEmpty } from "@/features/ad-accounts/components/AdAccountsPickClienteEmpty";
import { AdAccountsSummaryCards } from "@/features/ad-accounts/components/AdAccountsSummaryCards";
import { AdAccountsTable } from "@/features/ad-accounts/components/AdAccountsTable";
import { AdAccountsToolbar } from "@/features/ad-accounts/components/AdAccountsToolbar.client";
import { SelectedClienteBanner } from "@/features/ad-accounts/components/SelectedClienteBanner.client";
import { requirePermission } from "@/lib/auth/guards.server";
import { filterAdAccounts } from "@/lib/filter/ad-accounts";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getSearchParam } from "@/lib/search-params";
import type { AdAccountStatus } from "@/types/ad-account";
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
  await requirePermission("adAccounts:read");
  const params = await searchParams;
  const search = getSearchParam(params, "q");
  const status = resolveAccountStatusFilter(getSearchParam(params, "status", "all"));
  const includeArchived = getSearchParam(params, "archived") === "1";

  const selected = await getSelectedHecomCliente();

  if (!selected) {
    return (
      <div className={`${dashboardClasses.page} pb-24 md:pb-0`}>
        <AdAccountsPageHeader
          summary={{
            totalAccounts: 0,
            activeAccounts: 0,
            assignedBalance: 0,
            pendingSetup: 0,
          }}
          hecomScoped={false}
          hideCreate
        />
        <Card padding="none" className="overflow-hidden">
          <AdAccountsPickClienteEmpty />
        </Card>
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
        hideCreate
      />
      <SelectedClienteBanner
        clienteId={selected.id}
        clienteName={clienteName}
        accountCount={data.accounts.length}
      />
      <AdAccountsInfoAlert />
      <AdAccountsSummaryCards summary={data.summary} />
      <Card padding="none" className="overflow-hidden">
        <Suspense fallback={null}>
          <AdAccountsToolbar
            initialSearch={search}
            initialStatus={status}
            initialIncludeArchived={includeArchived}
          />
        </Suspense>
        {filteredAccounts.length === 0 && data.accounts.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--admin-text-muted,#64748b)]">
            <p className="font-semibold text-[var(--foreground)]">
              {clienteName} no tiene cuentas TikTok mapeadas en Hecom
            </p>
            <p className="mt-2">
              En Hecom Club falta <code>advertiser_id</code> para este cliente.
            </p>
          </div>
        ) : (
          <AdAccountsTable accounts={filteredAccounts} readOnly />
        )}
      </Card>
      <AdAccountsMobileStickyCta hideCreate />
    </div>
  );
}
