import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getHecomAdAccountsLiveMetrics } from "@/lib/hecom/ad-account-live.server";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import {
  formatBmBucketLabel,
  isHecomBmBucketHiddenForCliente,
} from "@/lib/hecom/bm-bucket.shared";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { enrichAllocationAccountsFromAdsOverview } from "@/lib/payments/enrich-allocation-accounts";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { scopeAllocationAccountsToHecomAdvertisers } from "@/lib/payments/scope-hecom-accounts";
import { listOrganizationAdAccountsForAllocation } from "@/services/payments.service";
import type { PaymentAccountAllocation } from "@/types/payment";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pulso de cuentas de un cliente para Links deuda (solo lectura).
 * Mismo scope que Pagos (mapa Hecom → overview) pero sin sync/ensure ni
 * topes de presupuesto: no escribe en la base ni en TikTok, y no usa la
 * cookie del cliente seleccionado.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clienteId: string }> },
) {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: "Solo gerencia." }, { status: 403 });
  }

  const { clienteId: raw } = await params;
  const clienteId = String(raw ?? "").trim().toLowerCase();
  if (!UUID_RE.test(clienteId)) {
    return NextResponse.json({ ok: false, error: "Cliente inválido." }, { status: 400 });
  }

  try {
    const [cliente, overview, clienteOrgId] = await Promise.all([
      getHecomCliente(clienteId),
      getHecomClienteAdAccountsOverview(clienteId, "fast"),
      resolveOrganizationIdForHecomCliente(clienteId),
    ]);

    // Igual que Pagos: mapa Hecom primero; si vacío, cuentas activas del overview.
    const mappedIds = (
      cliente && cliente.tiktokAccounts.length > 0
        ? cliente.tiktokAccounts.filter(
            (a) =>
              a.syncEnabled !== false &&
              !isHecomBmBucketHiddenForCliente(cliente.id, a.bmBucket),
          )
        : cliente?.tiktokAdvertiserId && cliente.tiktokSyncEnabled !== false
          ? [{ advertiserId: cliente.tiktokAdvertiserId }]
          : []
    )
      .map((a) => a.advertiserId.trim())
      .filter(Boolean);
    const overviewActiveIds = overview.accounts
      .filter((account) => account.status !== "disabled")
      .map((account) => account.externalAccountId?.trim())
      .filter((id): id is string => Boolean(id));
    const advertiserIds = [
      ...new Set(mappedIds.length > 0 ? mappedIds : overviewActiveIds),
    ];
    const suspendedIds = new Set(
      overview.accounts
        .filter((account) => account.status === "disabled")
        .map((account) => account.externalAccountId?.trim())
        .filter((id): id is string => Boolean(id)),
    );

    const organizationId = clienteOrgId ?? session.organizationId ?? null;
    const pool = organizationId
      ? await listOrganizationAdAccountsForAllocation(organizationId)
      : [];
    const scoped = enrichAllocationAccountsFromAdsOverview(
      scopeAllocationAccountsToHecomAdvertisers(pool, advertiserIds),
      overview.accounts,
    ).map((account) => {
      const ext = account.externalAccountId?.trim();
      return ext && suspendedIds.has(ext) ? { ...account, status: "disabled" } : account;
    });

    // Cuentas del cliente que aún no tienen fila en Holistic: se muestran
    // con ledger $0 (Pagos las crea al entrar; aquí no se escribe nada).
    const present = new Set(
      scoped.map((account) => account.externalAccountId?.trim()).filter(Boolean),
    );
    const overviewById = new Map(
      overview.accounts
        .map((account) => [account.externalAccountId?.trim() ?? "", account] as const)
        .filter(([id]) => Boolean(id)),
    );
    const missing: PaymentAccountAllocation[] = advertiserIds
      .filter((id) => !present.has(id))
      .map((id) => {
        const meta = overviewById.get(id);
        const name = meta?.externalAccountName?.trim() || meta?.name?.trim() || `TikTok ${id}`;
        return {
          id: `hecom:${id}`,
          name,
          externalAccountName: name,
          status: suspendedIds.has(id) ? "disabled" : (meta?.status ?? "active"),
          balance: 0,
          autoRecharge: false,
          thresholdInfo: "",
          externalAccountId: id,
          bmLabel: meta ? formatBmBucketLabel(meta.externalBusinessId, meta.bcId) : null,
        };
      });

    let live: Awaited<ReturnType<typeof getHecomAdAccountsLiveMetrics>> | null = null;
    let liveError: string | null = null;
    try {
      live = await getHecomAdAccountsLiveMetrics(clienteId, "fast");
    } catch (error) {
      liveError = error instanceof Error ? error.message : "Sin datos de TikTok.";
    }

    return NextResponse.json({
      ok: true,
      accounts: [...scoped, ...missing],
      live: live?.accounts ?? [],
      updatedAt: live?.updatedAt ?? null,
      liveError,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron cargar las cuentas.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
