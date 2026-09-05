import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { assertHecomClienteAccess } from "@/lib/hecom/assert-cliente-access.server";
import { getHecomAdAccountsLiveMetrics } from "@/lib/hecom/ad-account-live.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { enforceSharedBudgetCapsForLiveAccounts } from "@/lib/payments/enforce-shared-budget-cap.server";
import { isTikTokBcFundingEnabled } from "@/lib/integrations/tiktok/bc-finance.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requirePermission("adAccounts:read");
  const selected = await getSelectedHecomCliente(session.id);

  if (!selected?.id) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  if (!session.organizationId) {
    return NextResponse.json(
      { error: "Organización no disponible." },
      { status: 400 },
    );
  }

  try {
    await assertHecomClienteAccess(session, selected.id);
    const fresh =
      new URL(request.url).searchParams.get("fresh") === "1" ||
      new URL(request.url).searchParams.get("fresh") === "true";
    const result = await getHecomAdAccountsLiveMetrics(selected.id, "fast", {
      bypassCache: fresh,
    });

    let accounts = result.accounts;
    let budgetCaps: Array<{
      advertiserId: string;
      enforced: boolean;
      ledgerUsd: number;
      newHeadroomUsd: number | null;
      reason?: string;
    }> = [];

    // BM 10/30: cupo TikTok no puede superar ledger Holistic.
    if (isTikTokBcFundingEnabled() && accounts.length > 0) {
      const capped = await enforceSharedBudgetCapsForLiveAccounts({
        organizationId: session.organizationId,
        accounts,
        force: fresh,
      });
      accounts = capped.accounts;
      budgetCaps = capped.results
        .filter((r) => r.enforced || r.reason === "enforce_failed")
        .map((r) => ({
          advertiserId: r.advertiserId,
          enforced: r.enforced,
          ledgerUsd: r.ledgerUsd,
          newHeadroomUsd: r.newHeadroomUsd,
          reason: r.reason,
        }));
    }

    return NextResponse.json({
      ok: true,
      clienteId: selected.id,
      cached: !fresh,
      ...result,
      accounts,
      budgetCaps,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar saldo en vivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
