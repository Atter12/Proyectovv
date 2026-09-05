import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  HECOM_BM_BUCKET_TO_BC,
  isSharedCreditBmBucket,
} from "@/lib/hecom/bm-bucket.shared";
import { getAdAccountLedgerBalance } from "@/lib/ledger/ledger.server";
import { setSharedBmAdvertiserBudgetAbsolute } from "@/lib/integrations/tiktok/bc-finance.server";
import type { AdAccountLiveMetricsRow } from "@/lib/hecom/ad-account-live.server";

const ENFORCE_COOLDOWN_MS = 3 * 60_000;
const lastEnforceAt = new Map<string, number>();

export type SharedBudgetCapResult = {
  advertiserId: string;
  enforced: boolean;
  skipped: boolean;
  previousBudget: number | null;
  previousMode: string | null;
  newBudget: number | null;
  newHeadroomUsd: number | null;
  ledgerUsd: number;
  reason?: string;
};

function resolveBcId(bmBucket: string | null | undefined): string | null {
  const bucket = String(bmBucket ?? "").trim();
  if (!bucket) return null;
  return HECOM_BM_BUCKET_TO_BC[bucket] ?? null;
}

async function resolveAdAccountId(input: {
  organizationId: string;
  advertiserId: string;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_accounts")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("platform", "tiktok")
    .eq("external_account_id", input.advertiserId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/**
 * BM 10/30: el cupo gastable en TikTok no puede superar el ledger Holistic.
 * targetBudget = gastadoTikTok + saldoLedgerHolistic
 * (si ledger=0 → solo deja lo ya gastado; si UNLIMITED → fuerza tope finito).
 */
export async function enforceSharedBudgetCapForAdvertiser(input: {
  organizationId: string;
  advertiserId: string;
  bcId: string;
  /** Si ya lo tenés del live metrics. */
  currentBudgetUsd?: number | null;
  currentBudgetCostUsd?: number | null;
  currentBudgetMode?: string | null;
  isUnlimited?: boolean;
  force?: boolean;
}): Promise<SharedBudgetCapResult> {
  const advertiserId = input.advertiserId.trim();
  const bcId = input.bcId.trim();
  const cooldownKey = `${input.organizationId}:${advertiserId}`;
  const now = Date.now();
  if (
    !input.force &&
    lastEnforceAt.has(cooldownKey) &&
    now - (lastEnforceAt.get(cooldownKey) ?? 0) < ENFORCE_COOLDOWN_MS
  ) {
    return {
      advertiserId,
      enforced: false,
      skipped: true,
      previousBudget: input.currentBudgetUsd ?? null,
      previousMode: input.currentBudgetMode ?? null,
      newBudget: null,
      newHeadroomUsd: null,
      ledgerUsd: 0,
      reason: "cooldown",
    };
  }

  const adAccountId = await resolveAdAccountId({
    organizationId: input.organizationId,
    advertiserId,
  });
  const ledger = adAccountId
    ? await getAdAccountLedgerBalance(adAccountId)
    : null;
  const ledgerUsd = Math.max(
    0,
    Math.round(((ledger?.availableBalanceCents ?? 0) / 100) * 100) / 100,
  );

  const cost = Math.max(0, Number(input.currentBudgetCostUsd ?? 0) || 0);
  const budget = Number(input.currentBudgetUsd ?? 0);
  const mode = String(input.currentBudgetMode ?? "").toUpperCase();
  const unlimited =
    input.isUnlimited === true || mode === "UNLIMITED";
  const headroom = unlimited
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.round((budget - cost) * 100) / 100);

  // Solo bajar / salir de ilimitado. Nunca subir cupo acá (eso es Asignar).
  if (!unlimited && headroom <= ledgerUsd + 0.05) {
    lastEnforceAt.set(cooldownKey, now);
    return {
      advertiserId,
      enforced: false,
      skipped: true,
      previousBudget: Number.isFinite(budget) ? budget : null,
      previousMode: mode || null,
      newBudget: null,
      newHeadroomUsd: headroom,
      ledgerUsd,
      reason: "already_capped",
    };
  }

  const targetBudget = Math.round((cost + ledgerUsd) * 100) / 100;

  try {
    const result = await setSharedBmAdvertiserBudgetAbsolute({
      organizationId: input.organizationId,
      bcId,
      advertiserId,
      budgetUsd: targetBudget,
    });
    lastEnforceAt.set(cooldownKey, now);
    console.info("[shared-budget-cap] enforced", {
      advertiserId,
      ledgerUsd,
      cost,
      previousBudget: result.previousBudget,
      previousMode: result.previousMode,
      newBudget: result.newBudget,
      newMode: result.newMode,
      skipped: result.skipped,
    });
    return {
      advertiserId,
      enforced: !result.skipped,
      skipped: result.skipped,
      previousBudget: result.previousBudget,
      previousMode: result.previousMode,
      newBudget: result.newBudget,
      newHeadroomUsd: Math.max(
        0,
        Math.round((result.newBudget - cost) * 100) / 100,
      ),
      ledgerUsd,
    };
  } catch (error) {
    console.error("[shared-budget-cap] failed", {
      advertiserId,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      advertiserId,
      enforced: false,
      skipped: true,
      previousBudget: Number.isFinite(budget) ? budget : null,
      previousMode: mode || null,
      newBudget: null,
      newHeadroomUsd: null,
      ledgerUsd,
      reason: error instanceof Error ? error.message : "enforce_failed",
    };
  }
}

/** Aplica el tope a todas las cuentas SHARED del live metrics del cliente. */
export async function enforceSharedBudgetCapsForLiveAccounts(input: {
  organizationId: string;
  accounts: AdAccountLiveMetricsRow[];
  force?: boolean;
}): Promise<{
  results: SharedBudgetCapResult[];
  accounts: AdAccountLiveMetricsRow[];
}> {
  const results: SharedBudgetCapResult[] = [];
  const nextAccounts = input.accounts.map((row) => ({ ...row }));

  for (let i = 0; i < nextAccounts.length; i++) {
    const row = nextAccounts[i]!;
    const portfolio = String(row.paymentPortfolioType ?? "").toUpperCase();
    const shared =
      portfolio === "SHARED" ||
      row.showBudgetLimit === true ||
      isSharedCreditBmBucket(row.bmBucket);
    if (!shared) continue;

    const bcId = resolveBcId(row.bmBucket);
    if (!bcId) continue;

    const result = await enforceSharedBudgetCapForAdvertiser({
      organizationId: input.organizationId,
      advertiserId: row.advertiserId,
      bcId,
      currentBudgetUsd: row.budgetUsd,
      currentBudgetCostUsd: row.budgetCostUsd,
      currentBudgetMode: row.budgetMode,
      isUnlimited: row.isUnlimitedBudget,
      force: input.force,
    });
    results.push(result);

    if (result.enforced && result.newHeadroomUsd != null) {
      nextAccounts[i] = {
        ...row,
        balanceUsd: result.newHeadroomUsd,
        budgetUsd: result.newBudget,
        budgetMode: "CUSTOM_BUDGET",
        isUnlimitedBudget: false,
        showBudgetLimit: true,
      };
    }
  }

  return { results, accounts: nextAccounts };
}
