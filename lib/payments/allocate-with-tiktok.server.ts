import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allocateToAdAccount,
  confirmDepositInLedger,
  getWalletLedgerBalance,
} from "@/lib/ledger/ledger.server";
import { serverEnv } from "@/lib/env/env.server";
import {
  resolveBmBucketFromBcId,
  SYSTEM_ALLOCATABLE_BM_BUCKET,
} from "@/lib/hecom/bm-bucket.shared";
import { resolveBcIdForHecomBucket } from "@/lib/integrations/tiktok/bc-advertisers.server";
import {
  isTikTokBcFundingEnabled,
  transferBcFundsToAdvertiser,
} from "@/lib/integrations/tiktok/bc-finance.server";
import {
  assertTikTokCashMatchesCents,
  usdCentsToTikTokCashAmount,
} from "@/lib/payments/tiktok-transfer-amount";
import {
  createPaymentIntentRecord,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";

export interface AllocateWithTikTokInput {
  organizationId: string;
  adAccountId: string;
  amountCents: number;
  requestedBy: string;
  currency?: string;
  idempotencyKey?: string;
  description?: string;
  /**
   * Modo gerente: fondea con cash del BM sin exigir que el cliente
   * haya recargado cartera. Acredita un puente contable en Holistic.
   */
  agencyBmFunding?: boolean;
}

export interface AllocateWithTikTokResult {
  journalId: string;
  agencyBmFunding: boolean;
  tiktokTransfer: {
    attempted: boolean;
    requestId: string | null;
    tiktokRequestId: string | null;
    bcId: string | null;
    advertiserId: string | null;
  };
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

/** Si falta saldo Holistic en modo gerente, acredita el faltante como puente agencia→BM. */
async function ensureAgencyBmBridgeCredit(input: {
  organizationId: string;
  amountCents: number;
  requestedBy: string;
  currency: string;
  idempotencyKey: string;
}): Promise<string | null> {
  const wallet = await getWalletLedgerBalance(input.organizationId);
  const available = wallet?.availableBalanceCents ?? 0;
  if (available >= input.amountCents) return null;

  const needCents = input.amountCents - available;
  const walletId = await resolveWalletId(input.organizationId);
  const bridgeKey = `agency-bm-bridge:${input.idempotencyKey}`;

  const intent = await createPaymentIntentRecord({
    organizationId: input.organizationId,
    walletId,
    amountCents: needCents,
    currency: input.currency,
    provider: "manual",
    createdBy: input.requestedBy,
    idempotencyKey: bridgeKey,
    metadata: {
      source: "agency_bm_bridge",
      purpose: "staff_fund_from_bm",
      bridge_for_allocation: input.idempotencyKey,
    },
  });

  const providerReference = `agency-bm-bridge:${intent.id}`;
  const journalId = await confirmDepositInLedger({
    paymentIntentId: intent.id,
    providerReference,
    idempotencyKey: `ledger:deposit:${bridgeKey}`,
    metadata: {
      source: "agency_bm_bridge",
      funded_by: input.requestedBy,
    },
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "succeeded",
    providerReference,
    succeededAt: new Date().toISOString(),
    metadata: {
      source: "agency_bm_bridge",
      ledger_journal_id: journalId,
      funded_by: input.requestedBy,
    },
  });

  return journalId;
}

/**
 * Asigna saldo a una cuenta ads.
 * Cliente: exige cartera Holistic → TikTok BC → ledger.
 * Gerente (agencyBmFunding): TikTok BC primero → puente contable → ledger.
 * Importante: no acreditar cartera si TikTok falla (evita saldo fantasma).
 */
export async function allocateWithOptionalTikTokFunding(
  input: AllocateWithTikTokInput,
): Promise<AllocateWithTikTokResult> {
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("ad_accounts")
    .select("id, organization_id, platform, external_account_id, external_business_id, currency")
    .eq("id", input.adAccountId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      platform: string | null;
      external_account_id: string | null;
      external_business_id: string | null;
      currency: string | null;
    }>();

  if (error) throw new Error(error.message);
  if (!account || account.organization_id !== input.organizationId) {
    throw new Error("Cuenta publicitaria no encontrada en la organización.");
  }

  const idempotencyKey =
    input.idempotencyKey ??
    `allocation:${input.organizationId}:${input.adAccountId}:${input.amountCents}:${randomUUID()}`;

  const currency = (input.currency ?? account.currency ?? "USD").toUpperCase();
  const advertiserId = account.external_account_id?.trim() || "";
  // Si en DB quedó "200"/"10"/"30" (label Hecom) → BC real TikTok.
  // Si ya es el bc_id largo, resolve lo deja (vía fallback).
  const rawBusinessId = account.external_business_id?.trim() || "";
  const bcId =
    resolveBcIdForHecomBucket(
      rawBusinessId,
      rawBusinessId || serverEnv.tiktokDefaultBcId.trim() || null,
    ) || "";

  const fundingOn = isTikTokBcFundingEnabled();
  const isTikTok = (account.platform ?? "tiktok").toLowerCase() === "tiktok";
  const canFund = fundingOn && isTikTok && Boolean(advertiserId) && Boolean(bcId);
  const agencyBmFunding = Boolean(input.agencyBmFunding);

  let tiktokRequestId: string | null = null;
  let transferRequestId: string | null = null;
  let bridgeJournalId: string | null = null;
  let tiktokFundingSource: "cash" | "grant" | null = null;

  if (fundingOn && isTikTok && !advertiserId) {
    throw new Error(
      "Esta cuenta no tiene advertiser_id de TikTok (external_account_id). No se puede recargar el BM.",
    );
  }

  if (fundingOn && isTikTok && advertiserId && !bcId) {
    throw new Error(
      "Falta bc_id. Poné external_business_id en la cuenta o TIKTOK_DEFAULT_BC_ID en Vercel.",
    );
  }

  if (canFund && bcId) {
    const bmBucket = resolveBmBucketFromBcId(bcId);
    if (bmBucket && bmBucket !== SYSTEM_ALLOCATABLE_BM_BUCKET) {
      throw new Error(
        `Esta cuenta es BM ${bmBucket}. Solo BM ${SYSTEM_ALLOCATABLE_BM_BUCKET} se recarga desde Holistic. Para BM 10 / BM 30 contactá a soporte.`,
      );
    }
  }

  console.info("[payments/allocate] resolved_targets", {
    adAccountId: account.id,
    advertiserId: advertiserId || null,
    externalBusinessIdRaw: rawBusinessId || null,
    bcId: bcId || null,
    agencyBmFunding,
    fundingOn,
  });

  // Cliente: validar cartera antes de llamar a TikTok (no muta).
  if (!agencyBmFunding) {
    const wallet = await getWalletLedgerBalance(input.organizationId);
    const available = wallet?.availableBalanceCents ?? 0;
    if (available < input.amountCents) {
      throw new Error(
        `Insufficient wallet balance. available=${available}, requested=${input.amountCents}. Recargá la cartera Holistic del cliente antes de asignar.`,
      );
    }
  }

  // TikTok PRIMERO. Si falla, no tocamos ledger ni puente.
  // 1 USD asignado = 1 USD cash_amount en TikTok (sin fee extra en el transfer).
  if (canFund) {
    transferRequestId = `bc:${idempotencyKey}`;
    const cashAmount = usdCentsToTikTokCashAmount(input.amountCents);
    assertTikTokCashMatchesCents(cashAmount, input.amountCents);
    const transfer = await transferBcFundsToAdvertiser({
      organizationId: input.organizationId,
      bcId,
      advertiserId,
      cashAmount,
      requestId: transferRequestId,
      transferType: "RECHARGE",
    });
    tiktokRequestId = transfer.tiktokRequestId;
    tiktokFundingSource = transfer.fundingSource;
  } else if (agencyBmFunding) {
    throw new Error(
      "Modo gerente requiere TikTok BC funding activo (advertiser + bc_id + TIKTOK_BC_FUNDING_ENABLED).",
    );
  }

  // Solo después de TikTok OK (o funding off en camino cliente): puente + allocate.
  if (agencyBmFunding) {
    bridgeJournalId = await ensureAgencyBmBridgeCredit({
      organizationId: input.organizationId,
      amountCents: input.amountCents,
      requestedBy: input.requestedBy,
      currency,
      idempotencyKey,
    });
  }

  const journalId = await allocateToAdAccount({
    organizationId: input.organizationId,
    adAccountId: input.adAccountId,
    amountCents: input.amountCents,
    idempotencyKey,
    description: agencyBmFunding
      ? input.description ?? "Recarga gerente desde BM TikTok"
      : input.description ?? "Asignación desde dashboard",
    metadata: {
      source: agencyBmFunding ? "agency_bm" : "dashboard",
      requested_by: input.requestedBy,
      currency,
      agency_bm_funding: agencyBmFunding,
      agency_bm_bridge_journal_id: bridgeJournalId,
      tiktok_bc_funding_enabled: fundingOn,
      tiktok_bc_transfer_attempted: canFund,
      tiktok_bc_id: bcId || null,
      tiktok_advertiser_id: advertiserId || null,
      tiktok_cash_amount_usd: canFund
        ? usdCentsToTikTokCashAmount(input.amountCents)
        : null,
      tiktok_funding_source: tiktokFundingSource,
      tiktok_amount_cents: input.amountCents,
      tiktok_transfer_request_id: transferRequestId,
      tiktok_api_request_id: tiktokRequestId,
    },
  });

  return {
    journalId,
    agencyBmFunding,
    tiktokTransfer: {
      attempted: canFund,
      requestId: transferRequestId,
      tiktokRequestId,
      bcId: bcId || null,
      advertiserId: advertiserId || null,
    },
  };
}
