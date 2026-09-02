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
  getAdAccountLedgerBalance,
  refundAdAccountToWallet,
} from "@/lib/ledger/ledger.server";
import {
  assertTikTokCashMatchesCents,
  usdCentsToTikTokCashAmount,
} from "@/lib/payments/tiktok-transfer-amount";

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
  if (holisticAvailable <= 0) {
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
  if (requested > holisticAvailable) {
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
    forceLedgerOnly: Boolean(input.forceLedgerOnly),
  });

  if (canTalkTikTok && !input.forceLedgerOnly) {
    tiktokAttempted = true;
    try {
      if (shared) {
        const cashAmount = usdCentsToTikTokCashAmount(reclaimCents);
        assertTikTokCashMatchesCents(cashAmount, reclaimCents);
        const decreased = await decreaseSharedBmAdvertiserBudget({
          organizationId: input.organizationId,
          bcId,
          advertiserId,
          decreaseAmountUsd: cashAmount,
        });
        tiktokRequestId = decreased.tiktokRequestId;
        path = "budget_decrease";
      } else {
        // BM 200 (cash): REFUND lo que quede en TikTok (cap).
        const snapshot = await getAdvertiserBudgetSnapshot({
          bcId,
          advertiserId,
          organizationId: input.organizationId,
        });
        tiktokCashUsd =
          snapshot?.cashBalance != null
            ? Math.round(snapshot.cashBalance * 100) / 100
            : null;

        if (tiktokCashUsd != null) {
          const tiktokCents = Math.round(tiktokCashUsd * 100);
          if (tiktokCents <= 0) {
            throw new Error(
              "En TikTok esa cuenta ya no tiene cash disponible (se gastó o ya se retiró). No hay nada que jalar del BM.",
            );
          }
          reclaimCents = Math.min(reclaimCents, tiktokCents);
        }

        const cashAmount = usdCentsToTikTokCashAmount(reclaimCents);
        assertTikTokCashMatchesCents(cashAmount, reclaimCents);

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

  const journalId = await refundAdAccountToWallet({
    organizationId: input.organizationId,
    adAccountId: account.id,
    amountCents: reclaimCents,
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
    },
  });

  console.info("[payments/reclaim] ok", {
    adAccountId: account.id,
    reclaimCents,
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
