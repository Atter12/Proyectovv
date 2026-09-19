import { after } from "next/server";
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
import { fillMissingRejectFixHints } from "@/lib/creatives/reject-fix-hint.server";
import { hydrateRejectedCards } from "@/lib/creatives/hydrate-rejected.server";
import { isTikTokCreativePublishEnabled } from "@/lib/integrations/tiktok/creative-publish.server";
import { ensureAdvertisersInOrganizationForAllocation } from "@/services/payments.service";
import { syncApprovedAdAccountsForCliente } from "@/lib/hecom/sync-approved-ad-accounts.server";

const ENTRY_ASSET_LIMIT = 50;
const RECENT_REJECT_LIMIT = 8;

export default async function CreativeAnalyzerPage() {
  const t0 = Date.now();
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

  const tDashboard = Date.now();
  const data = await getHecomClienteDashboard(selected.id, {
    includeCampaignSpend: false,
    includeDailySpend: false,
    includeCreativos: true,
  });
  const dashboardMs = Date.now() - tDashboard;

  if (!data) {
    return (
      <div className={dashboardClasses.page}>
        <PickClienteEmpty section="el analizador creativo" mode={mode} />
      </div>
    );
  }

  const hecomAdvertiserIds = data.accounts
    .map((a) => a.advertiserId)
    .filter((id): id is string => Boolean(id));

  const tAccounts = Date.now();
  const accounts = session.organizationId
    ? await listCreativeAccountOptions(session.organizationId, {
        hecomClienteId: selected.id,
        advertiserIds: hecomAdvertiserIds,
      })
    : [];
  const accountsMs = Date.now() - tAccounts;

  const advertiserIds = [
    ...new Set([
      ...hecomAdvertiserIds,
      ...accounts
        .map((a) => a.externalAccountId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];

  const scopeOpts = {
    hecomClienteId: selected.id,
    advertiserIds,
    adAccountIds: accounts.map((a) => a.id),
  };

  const tLists = Date.now();
  const [assets, rejectedDrafts, readyDrafts] = session.organizationId
    ? await Promise.all([
        listOrganizationCreativeAssets(session.organizationId, {
          ...scopeOpts,
          limit: ENTRY_ASSET_LIMIT,
        }),
        listOrganizationCreativeDrafts(session.organizationId, {
          ...scopeOpts,
          recentRejected: true,
          limit: RECENT_REJECT_LIMIT,
        }),
        listOrganizationCreativeDrafts(session.organizationId, {
          ...scopeOpts,
          statusIn: ["draft", "approved", "failed", "publishing"],
          limit: 8,
        }),
      ])
    : [[], [], []];
  const seen = new Set(rejectedDrafts.map((d) => d.id));
  let rejectedReady = rejectedDrafts;
  if (session.organizationId && rejectedDrafts.length > 0) {
    try {
      rejectedReady = await hydrateRejectedCards(
        session.organizationId,
        rejectedDrafts,
      );
      await fillMissingRejectFixHints(rejectedReady);
    } catch (error) {
      console.warn("[creative-analyzer] hydrate_rejected", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  const drafts = [
    ...rejectedReady,
    ...readyDrafts.filter((d) => !seen.has(d.id)),
  ];
  const listsMs = Date.now() - tLists;
  const totalMs = Date.now() - t0;

  console.info("[creative-analyzer] entry_timing", {
    clienteId: selected.id,
    dashboardMs,
    accountsMs,
    listsMs,
    totalMs,
    advertisers: advertiserIds.length,
    assets: assets.length,
    drafts: drafts.length,
  });

  // Sync BC + ensure + discovery TikTok: fuera del path crítico (after).
  if (session.organizationId) {
    const organizationId = session.organizationId;
    const clienteId = selected.id;
    const clienteName = data.cliente.name;
    const userId = session.id;
    const accountRows = accounts.map((a) => ({
      id: a.id,
      externalAccountId: a.externalAccountId,
      name: a.name,
    }));
    const hecomAccountNames = new Map(
      data.accounts
        .filter((a) => a.advertiserId)
        .map((a) => [a.advertiserId as string, a.advertiserName ?? null]),
    );

    after(async () => {
      const bg0 = Date.now();
      let syncAdvertiserIds: string[] = [];
      try {
        const sync = await syncApprovedAdAccountsForCliente({
          organizationId,
          clienteId,
          userId,
          forceRefresh: false,
        });
        syncAdvertiserIds = sync.approvedAdvertiserIds;
      } catch (error) {
        console.warn("[creative-analyzer] bg_account_sync", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }

      const bgAdvertiserIds = [
        ...new Set([
          ...syncAdvertiserIds,
          ...hecomAdvertiserIds,
          ...accountRows
            .map((a) => a.externalAccountId)
            .filter((id): id is string => Boolean(id)),
        ]),
      ];

      if (bgAdvertiserIds.length > 0) {
        try {
          await ensureAdvertisersInOrganizationForAllocation({
            organizationId,
            clienteId,
            clienteName,
            userId,
            advertisers: bgAdvertiserIds.map((advertiserId) => ({
              advertiserId,
              name:
                hecomAccountNames.get(advertiserId) ??
                accountRows.find((a) => a.externalAccountId === advertiserId)
                  ?.name ??
                null,
            })),
          });
        } catch (error) {
          console.warn("[creative-analyzer] bg_ensure_advertisers", {
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      }

      const discoverIds =
        bgAdvertiserIds.length > 0 ? bgAdvertiserIds : advertiserIds;
      if (discoverIds.length === 0) return;

      const discover0 = Date.now();
      try {
        const result = await discoverRejectedAdsForOrganization({
          organizationId,
          advertiserIds: discoverIds,
          adAccountIds: accountRows.map((a) => a.id),
        });
        console.info("[creative-analyzer] bg_discover", {
          discoverMs: Date.now() - discover0,
          bgTotalMs: Date.now() - bg0,
          advertisers: result.advertisers,
          listed: result.listed,
          upserted: result.upserted,
          rejected: result.rejected,
          skippedByTtl: result.skippedByTtl === true,
        });
      } catch (error) {
        console.warn("[creative-analyzer] bg_discover", {
          error: error instanceof Error ? error.message : "unknown",
          discoverMs: Date.now() - discover0,
        });
      }

      try {
        const freshRejected = await listOrganizationCreativeDrafts(
          organizationId,
          {
            hecomClienteId: clienteId,
            advertiserIds: discoverIds,
            adAccountIds: accountRows.map((a) => a.id),
            recentRejected: true,
            limit: RECENT_REJECT_LIMIT,
          },
        );
        const filled = await fillMissingRejectFixHints(freshRejected);
        if (filled > 0) {
          console.info("[creative-analyzer] reject_fix_hints", { filled });
        }
      } catch (error) {
        console.warn("[creative-analyzer] reject_fix_hints", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    });
  }

  return (
    <div className={dashboardClasses.page}>
      <ClienteScopedCreatives
        data={data}
        accounts={accounts}
        assets={assets}
        drafts={drafts}
        publishEnabled={isTikTokCreativePublishEnabled()}
        expectDiscoverRefresh={advertiserIds.length > 0}
      />
    </div>
  );
}
