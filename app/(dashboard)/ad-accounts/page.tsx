import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { Card } from "@/components/ui/Card";
import { AdAccountsPageHeader } from "@/features/ad-accounts/components/AdAccountsPageHeader";
import { AdAccountsInfoAlert } from "@/features/ad-accounts/components/AdAccountsInfoAlert";
import { AdAccountsMobileStickyCta } from "@/features/ad-accounts/components/AdAccountsMobileStickyCta.client";
import { AdAccountsSummaryCards } from "@/features/ad-accounts/components/AdAccountsSummaryCards";
import { AdAccountsTable } from "@/features/ad-accounts/components/AdAccountsTable";
import { AdAccountsToolbar } from "@/features/ad-accounts/components/AdAccountsToolbar.client";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { SelectedClienteBanner } from "@/features/clientes/components/SelectedClienteBanner.client";
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
  void includeArchived;

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
        <PickClienteEmpty section="las cuentas publicitarias" />
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
        avatarUrl={data.cliente?.avatarUrl}
        detail="Solo cuentas TikTok de este cliente."
      />
      <AdAccountsInfoAlert />
      <AdAccountsSummaryCards summary={data.summary} />
      <Card
        padding="none"
        className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_12px_32px_rgb(20_18_16_/_0.05)]"
      >
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
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#16161a] text-[#fe2c55]">
              <span className="text-[11px] font-bold tracking-wide">TT</span>
            </div>
            <p className="mt-4 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
              {clienteName} no tiene cuentas TikTok mapeadas
            </p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[#6b645c]">
              En Hecom Club falta el <code className="rounded bg-[#f0e9e0] px-1.5 py-0.5 text-[12px]">advertiser_id</code>{" "}
              para este cliente. Cuando esté mapeado, aparece acá en solo lectura.
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
