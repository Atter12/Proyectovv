import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { ClienteScopedCreatives } from "@/features/clientes/components/ClienteScopedCreatives";
import { PickClienteEmpty } from "@/features/clientes/components/PickClienteEmpty";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requirePermission } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  listCreativeAccountOptions,
  listOrganizationCreativeAssets,
  listOrganizationCreativeDrafts,
} from "@/lib/creatives/list-creatives.server";
import { discoverRejectedAdsForOrganization } from "@/lib/creatives/discover-tiktok-ads.server";
import { isTikTokCreativePublishEnabled } from "@/lib/integrations/tiktok/creative-publish.server";
import { ensureAdvertisersInOrganizationForAllocation } from "@/services/payments.service";
import { syncApprovedAdAccountsForCliente } from "@/lib/hecom/sync-approved-ad-accounts.server";

export default async function CreativeAnalyzerPage() {
  const session = await requirePermission("creativeAnalyzer:read");
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const mode =
    funding.isStaff || funding.isSuperAdmin ? "staff" : "cliente";
  const selected = await getSelectedHecomCliente(session.id);

  if (!selected) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el analizador creativo" mode={mode} />
      </div>
    );
  }

  const data = await getHecomClienteDashboard(selected.id);
  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el analizador creativo" mode={mode} />
      </div>
    );
  }

  let syncAdvertiserIds: string[] = [];
  if (session.organizationId) {
    try {
      const sync = await syncApprovedAdAccountsForCliente({
        organizationId: session.organizationId,
        clienteId: selected.id,
        userId: session.id,
        forceRefresh: false,
      });
      syncAdvertiserIds = sync.approvedAdvertiserIds;
      const ids =
        sync.approvedAdvertiserIds.length > 0
          ? sync.approvedAdvertiserIds
          : data.accounts
              .map((a) => a.advertiserId)
              .filter((id): id is string => Boolean(id));
      if (ids.length > 0) {
        await ensureAdvertisersInOrganizationForAllocation({
          organizationId: session.organizationId,
          clienteId: selected.id,
          clienteName: data.cliente.name,
          userId: session.id,
          advertisers: ids.map((advertiserId) => ({
            advertiserId,
            name:
              data.accounts.find((a) => a.advertiserId === advertiserId)
                ?.advertiserName ?? null,
          })),
        });
      }
    } catch (error) {
      console.warn("[creative-analyzer] account_sync", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const hecomAdvertiserIds = data.accounts
    .map((a) => a.advertiserId)
    .filter((id): id is string => Boolean(id));
  const advertiserIds = [
    ...new Set([...syncAdvertiserIds, ...hecomAdvertiserIds]),
  ];

  const accounts = session.organizationId
    ? await listCreativeAccountOptions(session.organizationId, {
        hecomClienteId: selected.id,
        advertiserIds,
      })
    : [];

  const scopeOpts = {
    hecomClienteId: selected.id,
    advertiserIds: [
      ...new Set([
        ...advertiserIds,
        ...accounts
          .map((a) => a.externalAccountId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ],
    adAccountIds: accounts.map((a) => a.id),
  };

  // Descubrir ads rechazados en Ads Manager (aunque no se hayan publicado desde Holistic).
  const discoverAdvertiserIds = scopeOpts.advertiserIds;
  if (session.organizationId && discoverAdvertiserIds.length > 0) {
    try {
      await discoverRejectedAdsForOrganization({
        organizationId: session.organizationId,
        advertiserIds: discoverAdvertiserIds,
        adAccountIds: accounts.map((a) => a.id),
      });
    } catch (error) {
      console.warn("[creative-analyzer] discover_ads", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const [assets, drafts] = session.organizationId
    ? await Promise.all([
        listOrganizationCreativeAssets(session.organizationId, scopeOpts),
        listOrganizationCreativeDrafts(session.organizationId, {
          ...scopeOpts,
          // Traer más filas para no perder rechazos descubiertos.
          // (list interno ya limita; el scope filtra por advertiser)
        }),
      ])
    : [[], []];

  return (
    <div className={dashboardClasses.page}>
      <ClienteScopedCreatives
        data={data}
        accounts={accounts}
        assets={assets}
        drafts={drafts}
        publishEnabled={isTikTokCreativePublishEnabled()}
      />
    </div>
  );
}
