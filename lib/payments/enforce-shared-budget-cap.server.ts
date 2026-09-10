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

  const { data: rows } = await admin
    .from("ad_accounts")
    .select("id, organization_id")
    .eq("platform", "tiktok")
    .eq("external_account_id", input.advertiserId)
    .limit(30);

  const candidates = (rows ?? []) as Array<{
    id: string;
    organization_id: string;
  }>;
  if (candidates.length === 0) return null;

  // Preferir la org de cartera del cliente si tiene ledger > 0; si no, la de
  // mayor saldo (evita mirrors de staff con $0 que reseteaban TikTok).
  let bestId: string | null = null;
  let bestCents = -1;
  let sessionId: string | null = null;
  let sessionCents = -1;

  for (const row of candidates) {
    const ledger = await getAdAccountLedgerBalance(row.id);
    const cents = ledger?.availableBalanceCents ?? 0;
    if (row.organization_id === input.organizationId) {
      sessionId = row.id;
      sessionCents = cents;
    }
    if (cents > bestCents) {
      bestCents = cents;
      bestId = row.id;
    }
  }

  // Ads Holistic BM10/30: si la org del cliente existe (aunque ledger=0),
  // usar esa fila para poder bajar cupo a gastado+0 (estilo BM200).
  if (sessionId) {
    if (sessionCents > 0) return sessionId;
    if (input.organizationId) return sessionId;
  }
  if (bestId && bestCents > 0) return bestId;
  return sessionId ?? bestId ?? candidates[0]!.id;
}

/**
 * BM 10/30 estilo BM200: el cupo gastable en TikTok = saldo ledger Holistic.
 * targetBudget = gastadoTikTok + saldoLedgerHolistic
 * (ledger=0 → solo deja lo ya gastado; UNLIMITED → fuerza tope finito).
 *
 * `adsHolisticClient=true`: sí bajar cupo aunque ledger sea $0 (clientes con
 * login/pagos Ads Holistic). `false`: no tocar cuentas solo-Hecom/agencia.
 */
export async function enforceSharedBudgetCapForAdvertiser(input: {
  organizationId: string;
  advertiserId: string;
  bcId: string;
  currentBudgetUsd?: number | null;
  currentBudgetCostUsd?: number | null;
  currentBudgetMode?: string | null;
  isUnlimited?: boolean;
  force?: boolean;
  /** Cliente Ads Holistic (cartera) → cap estricto incluso con ledger $0. */
  adsHolisticClient?: boolean;
}): Promise<SharedBudgetCapResult> {
  const advertiserId = input.advertiserId.trim();
  const bcId = input.bcId.trim();
  const adsHolistic = input.adsHolisticClient === true;
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
  if (!adAccountId) {
    lastEnforceAt.set(cooldownKey, now);
    return {
      advertiserId,
      enforced: false,
      skipped: true,
      previousBudget: input.currentBudgetUsd ?? null,
      previousMode: input.currentBudgetMode ?? null,
      newBudget: null,
      newHeadroomUsd: null,
      ledgerUsd: 0,
      reason: "no_ad_account_ledger",
    };
  }

  const ledger = await getAdAccountLedgerBalance(adAccountId);
  if (!ledger) {
    lastEnforceAt.set(cooldownKey, now);
    return {
      advertiserId,
      enforced: false,
      skipped: true,
      previousBudget: input.currentBudgetUsd ?? null,
      previousMode: input.currentBudgetMode ?? null,
      newBudget: null,
      newHeadroomUsd: null,
      ledgerUsd: 0,
      reason: "ledger_unavailable",
    };
  }
  const ledgerUsd = Math.max(
    0,
    Math.round((ledger.availableBalanceCents / 100) * 100) / 100,
  );

  const cost = Math.max(0, Number(input.currentBudgetCostUsd ?? 0) || 0);
  const budget = Number(input.currentBudgetUsd ?? 0);
  const mode = String(input.currentBudgetMode ?? "").toUpperCase();
  const unlimited =
    input.isUnlimited === true || mode === "UNLIMITED";
  const headroom = unlimited
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.round((budget - cost) * 100) / 100);

  if (!unlimited && headroom <= ledgerUsd + 0.05 && headroom + 0.05 >= ledgerUsd) {
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

  // Cuentas solo-agencia / Hecom sin Ads Holistic: no bajar cupo con ledger $0
  // (evitar matar presupuestos de clientes que no pasan por cartera Holistic).
  if (ledgerUsd <= 0 && headroom > 0.05 && !unlimited && !adsHolistic) {
    lastEnforceAt.set(cooldownKey, now);
    console.warn("[shared-budget-cap] skip_zero_ledger_with_tiktok_headroom", {
      advertiserId,
      organizationId: input.organizationId,
      adAccountId,
      headroom,
      budget,
      cost,
    });
    return {
      advertiserId,
      enforced: false,
      skipped: true,
      previousBudget: Number.isFinite(budget) ? budget : null,
      previousMode: mode || null,
      newBudget: null,
      newHeadroomUsd: headroom,
      ledgerUsd,
      reason: "skip_zero_ledger_preserve_tiktok",
    };
  }

  const targetBudget = Math.round((cost + ledgerUsd) * 100) / 100;

  try {
    const result = await setSharedBmAdvertiserBudgetAbsolute({
      organizationId: input.organizationId,
      bcId,
      advertiserId,
      budgetUsd: targetBudget,
      preferBudgetMode: "CUSTOM_BUDGET",
    });
    lastEnforceAt.set(cooldownKey, now);
    console.info("[shared-budget-cap] enforced", {
      advertiserId,
      adsHolistic,
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
  /** true = cliente Ads Holistic → cap estricto estilo BM200. */
  adsHolisticClient?: boolean;
}): Promise<{
  results: SharedBudgetCapResult[];
  accounts: AdAccountLiveMetricsRow[];
}> {
  const results: SharedBudgetCapResult[] = [];
  const nextAccounts = input.accounts.map((row) => ({ ...row }));
  const adsHolistic = input.adsHolisticClient === true;

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
      adsHolisticClient: adsHolistic,
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
