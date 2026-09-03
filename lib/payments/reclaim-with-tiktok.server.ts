import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import {
  isSharedCreditBmBucket,
  resolveBmBucketFromBcId,
} from "@/lib/hecom/bm-bucket.shared";
import { resolveBcIdForHecomBucket } from "@/lib/integrations/tiktok/bc-advertisers.server";
import {
  decreaseSharedBmAdvertiserBudget,
  getAdvertiserBudgetSnapshot,
  isTikTokBcFundingEnabled,
  transferBcFundsToAdvertiser,
} from "@/lib/integrations/tiktok/bc-finance.server";
import {
  confirmDepositInLedger,
  getAdAccountLedgerBalance,
  refundAdAccountToWallet,
} from "@/lib/ledger/ledger.server";
import {
  createPaymentIntentRecord,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import {
  assertTikTokCashMatchesCents,
  usdCentsToTikTokCashAmount,
} from "@/lib/payments/tiktok-transfer-amount";
import {
  spendableUsdFromFinanceSnapshot,
  usdToCents,
} from "@/lib/integrations/tiktok/spendable-budget.shared";

export interface ReclaimFromAdAccountInput {
  organizationId: string;
  adAccountId: string;
  /** Si omitís, recupera todo el saldo Holistic disponible (capado por cash TikTok en BM200). */
  amountCents?: number;
  requestedBy: string;
  idempotencyKey?: string;
  /**
   * Solo staff: si TikTok falla (cuenta trabada), igual devolver ledger
   * a cartera. Riesgo: cash puede seguir en el advertiser en TikTok.
   */
  forceLedgerOnly?: boolean;
  /**
   * Transferencia entre cuentas: permite jalar cupo TikTok aunque el
   * ledger Holistic esté en $0 (plata que ya estaba en Manager).
   * No usar en “Recuperar a cartera”: eso sí exige ledger.
   */
  allowTikTokOverLedger?: boolean;
}

export interface ReclaimFromAdAccountResult {
  journalId: string;
  amountCents: number;
  path: "cash_deduct" | "budget_decrease" | "ledger_only";
  tiktokAttempted: boolean;
  tiktokRequestId: string | null;
  holisticAvailableBeforeCents: number;
  tiktokCashUsd: number | null;
}

async function resolveWalletId(organizationId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("No hay cartera Holistic para esta organización.");
  return data.id;
}

/** Acredita en cartera plata que ya estaba en TikTok y no figuraba en Holistic. */
async function creditWalletForExistingTikTokBalance(input: {
  organizationId: string;
  amountCents: number;
  requestedBy: string;
  idempotencyKey: string;
  adAccountId: string;
}): Promise<string> {
  const walletId = await resolveWalletId(input.organizationId);
  const importKey = `tiktok-balance-import:${input.idempotencyKey}`;

  const intent = await createPaymentIntentRecord({
    organizationId: input.organizationId,
    walletId,
    amountCents: input.amountCents,
    currency: "USD",
    provider: "manual",
    createdBy: input.requestedBy,
    idempotencyKey: importKey,
    metadata: {
      source: "tiktok_balance_import",
      purpose: "transfer_existing_tiktok_balance",
      ad_account_id: input.adAccountId,
    },
  });

  const providerReference = `tiktok-balance-import:${intent.id}`;
  const journalId = await confirmDepositInLedger({
    paymentIntentId: intent.id,
    providerReference,
    idempotencyKey: `ledger:deposit:${importKey}`,
    metadata: {
      source: "tiktok_balance_import",
      funded_by: input.requestedBy,
      ad_account_id: input.adAccountId,
    },
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "succeeded",
    providerReference,
    succeededAt: new Date().toISOString(),
    metadata: {
      source: "tiktok_balance_import",
      ledger_journal_id: journalId,
      funded_by: input.requestedBy,
      ad_account_id: input.adAccountId,
    },
  });

  return journalId;
}

/**
 * Recupera saldo de una cuenta ads → cartera Holistic.
 * Caso típico: cuenta BM200 baneada con cash sin gastar.
 *
 * BM 200: REFUND cash advertiser → BC, luego ledger refund.
 * BM 10/30: baja presupuesto (best-effort) + ledger refund.
 */
export async function reclaimFromAdAccountWithTikTok(
  input: ReclaimFromAdAccountInput,
): Promise<ReclaimFromAdAccountResult> {
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("ad_accounts")
    .select(
      "id, organization_id, platform, external_account_id, external_business_id, status, name",
    )
    .eq("id", input.adAccountId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      platform: string | null;
      external_account_id: string | null;
      external_business_id: string | null;
      status: string;
      name: string;
    }>();

  if (error) throw new Error(error.message);
  if (!account || account.organization_id !== input.organizationId) {
    throw new Error("Cuenta publicitaria no encontrada en la organización.");
  }

  const ledger = await getAdAccountLedgerBalance(account.id);
  const holisticAvailable = ledger?.availableBalanceCents ?? 0;
  const allowTikTokOverLedger = Boolean(input.allowTikTokOverLedger);

  if (holisticAvailable <= 0 && !allowTikTokOverLedger) {
    throw new Error(
      "Esta cuenta no tiene saldo Holistic recuperable (ya está en $0 o se gastó).",
    );
  }

  const requested =
    input.amountCents != null && Number.isFinite(input.amountCents)
      ? Math.floor(input.amountCents)
      : holisticAvailable;
  if (requested <= 0) {
    throw new Error("Monto a recuperar inválido.");
  }
  if (!allowTikTokOverLedger && requested > holisticAvailable) {
    throw new Error(
      `Solo hay ${(holisticAvailable / 100).toFixed(2)} USD recuperables en Holistic para esta cuenta.`,
    );
  }

  const advertiserId = account.external_account_id?.trim() || "";
  const rawBusinessId = account.external_business_id?.trim() || "";
  const bcId =
    resolveBcIdForHecomBucket(
      rawBusinessId,
      rawBusinessId || serverEnv.tiktokDefaultBcId.trim() || null,
    ) || "";
  const bmBucket = bcId ? resolveBmBucketFromBcId(bcId) : null;
  const isTikTok = (account.platform ?? "tiktok").toLowerCase() === "tiktok";
  const fundingOn = isTikTokBcFundingEnabled();
  const canTalkTikTok = fundingOn && isTikTok && Boolean(advertiserId) && Boolean(bcId);
  const shared = isSharedCreditBmBucket(bmBucket) || bmBucket === "10" || bmBucket === "30";

  const idempotencyKey =
    input.idempotencyKey ??
    `reclaim:${input.organizationId}:${account.id}:${requested}:${randomUUID()}`;

  let reclaimCents = requested;
  let tiktokCashUsd: number | null = null;
  let tiktokRequestId: string | null = null;
  let path: ReclaimFromAdAccountResult["path"] = "ledger_only";
  let tiktokAttempted = false;

  console.info("[payments/reclaim] start", {
    adAccountId: account.id,
    advertiserId: advertiserId || null,
    bcId: bcId || null,
    bmBucket,
    shared,
    status: account.status,
    holisticAvailable,
    requested,
    allowTikTokOverLedger,
    forceLedgerOnly: Boolean(input.forceLedgerOnly),
  });

  if (canTalkTikTok && !input.forceLedgerOnly) {
    tiktokAttempted = true;
    try {
      const snapshot = await getAdvertiserBudgetSnapshot({
        bcId,
        advertiserId,
        organizationId: input.organizationId,
      });
      if (!snapshot && allowTikTokOverLedger) {
        throw new Error(
          "No se pudo leer el saldo TikTok de esa cuenta. Probá de nuevo en unos segundos.",
        );
      }

      const spendableUsd = snapshot
        ? spendableUsdFromFinanceSnapshot({
            paymentPortfolioType: snapshot.paymentPortfolioType,
            cashBalance: snapshot.cashBalance,
            validCashBalance: snapshot.validCashBalance,
            budget: snapshot.budget,
            budgetCost: snapshot.budgetCost,
            accountBalance: snapshot.accountBalance,
            budgetMode: snapshot.budgetMode,
            forTransfer: allowTikTokOverLedger,
          })
        : null;
      const spendableCents = usdToCents(spendableUsd);
      tiktokCashUsd = spendableUsd;

      if (allowTikTokOverLedger) {
        if (spendableCents <= 0) {
          throw new Error(
            "En TikTok esa cuenta no tiene saldo gastable para transferir (cash o cupo de presupuesto).",
          );
        }
        reclaimCents = Math.min(requested, spendableCents);
      } else if (snapshot && spendableCents <= 0) {
        throw new Error(
          "En TikTok esa cuenta ya no tiene saldo disponible (se gastó o ya se retiró). No hay nada que jalar del BM.",
        );
      } else if (spendableCents > 0) {
        reclaimCents = Math.min(reclaimCents, spendableCents);
      }

      if (reclaimCents <= 0) {
        throw new Error("No quedó monto recuperable después de consultar TikTok.");
      }

      const cashAmount = usdCentsToTikTokCashAmount(reclaimCents);
      assertTikTokCashMatchesCents(cashAmount, reclaimCents);

      if (shared) {
        const decreased = await decreaseSharedBmAdvertiserBudget({
          organizationId: input.organizationId,
          bcId,
          advertiserId,
          decreaseAmountUsd: cashAmount,
        });
        tiktokRequestId = decreased.tiktokRequestId;
        path = "budget_decrease";
      } else {
        const transfer = await transferBcFundsToAdvertiser({
          organizationId: input.organizationId,
          bcId,
          advertiserId,
          cashAmount,
          requestId: `bc:reclaim:${idempotencyKey}`,
          transferType: "REFUND",
        });
        tiktokRequestId = transfer.tiktokRequestId;
        path = "cash_deduct";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "TikTok reclaim falló";
      console.error("[payments/reclaim] tiktok_failed", {
        adAccountId: account.id,
        message,
      });
      if (!input.forceLedgerOnly) {
        throw new Error(
          `${message} Tu saldo Holistic no se tocó. Si TikTok tiene el cash trabado, pedí a soporte recuperación manual o force ledger (staff).`,
        );
      }
      path = "ledger_only";
      tiktokAttempted = true;
    }
  } else if (
    allowTikTokOverLedger &&
    !input.forceLedgerOnly &&
    !canTalkTikTok
  ) {
    throw new Error(
      "Falta advertiser_id o bc_id para mover el saldo TikTok. Completá el ID o pedí a soporte.",
    );
  } else if (!canTalkTikTok && !input.forceLedgerOnly && fundingOn && isTikTok) {
    throw new Error(
      "Falta advertiser_id o bc_id para recuperar en TikTok. Completá el ID o pedí a soporte.",
    );
  } else if (input.forceLedgerOnly) {
    path = "ledger_only";
  }

  if (reclaimCents <= 0) {
    throw new Error("No quedó monto recuperable después de consultar TikTok.");
  }

  const ledgerRefundCents = Math.min(holisticAvailable, reclaimCents);
  const importCents = reclaimCents - ledgerRefundCents;
  let journalId: string | null = null;

  if (ledgerRefundCents > 0) {
    journalId = await refundAdAccountToWallet({
      organizationId: input.organizationId,
      adAccountId: account.id,
      amountCents: ledgerRefundCents,
      idempotencyKey: `ledger:reclaim:${idempotencyKey}`,
      description: `Recuperación a cartera · ${account.name}`,
      metadata: {
        source: "reclaim_dashboard",
        requested_by: input.requestedBy,
        reclaim_path: path,
        force_ledger_only: Boolean(input.forceLedgerOnly),
        tiktok_attempted: tiktokAttempted,
        tiktok_bc_id: bcId || null,
        tiktok_advertiser_id: advertiserId || null,
        tiktok_api_request_id: tiktokRequestId,
        tiktok_cash_usd_before: tiktokCashUsd,
        account_status: account.status,
        bm_bucket: bmBucket,
        imported_tiktok_cents: importCents,
      },
    });
  }

  if (importCents > 0) {
    if (!allowTikTokOverLedger) {
      throw new Error(
        "El monto supera el saldo Holistic de la cuenta. Transferí solo lo asignado o usá Transferir (saldo TikTok).",
      );
    }
    journalId = await creditWalletForExistingTikTokBalance({
      organizationId: input.organizationId,
      amountCents: importCents,
      requestedBy: input.requestedBy,
      idempotencyKey,
      adAccountId: account.id,
    });
  }

  if (!journalId) {
    throw new Error("No se pudo asentar la recuperación en Holistic.");
  }

  console.info("[payments/reclaim] ok", {
    adAccountId: account.id,
    reclaimCents,
    ledgerRefundCents,
    importCents,
    path,
    journalId,
    tiktokRequestId,
  });

  return {
    journalId,
    amountCents: reclaimCents,
    path,
    tiktokAttempted,
    tiktokRequestId,
    holisticAvailableBeforeCents: holisticAvailable,
    tiktokCashUsd,
  };
}
