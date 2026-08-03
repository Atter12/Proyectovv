import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allocateToAdAccount,
  getWalletLedgerBalance,
} from "@/lib/ledger/ledger.server";
import { serverEnv } from "@/lib/env/env.server";
import {
  isTikTokBcFundingEnabled,
  transferBcFundsToAdvertiser,
} from "@/lib/integrations/tiktok/bc-finance.server";

export interface AllocateWithTikTokInput {
  organizationId: string;
  adAccountId: string;
  amountCents: number;
  requestedBy: string;
  currency?: string;
  idempotencyKey?: string;
  description?: string;
}

export interface AllocateWithTikTokResult {
  journalId: string;
  tiktokTransfer: {
    attempted: boolean;
    requestId: string | null;
    tiktokRequestId: string | null;
    bcId: string | null;
    advertiserId: string | null;
  };
}

/**
 * Asigna saldo a una cuenta ads.
 * Si TIKTOK_BC_FUNDING_ENABLED=true y la cuenta tiene advertiser (+ bc),
 * primero valida cartera Holistic, luego RECHARGE en TikTok BC, luego ledger.
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

  const advertiserId = account.external_account_id?.trim() || "";
  const bcId =
    account.external_business_id?.trim() ||
    serverEnv.tiktokDefaultBcId.trim() ||
    "";

  const fundingOn = isTikTokBcFundingEnabled();
  const isTikTok = (account.platform ?? "tiktok").toLowerCase() === "tiktok";
  const canFund = fundingOn && isTikTok && Boolean(advertiserId) && Boolean(bcId);

  let tiktokRequestId: string | null = null;
  let transferRequestId: string | null = null;

  if (fundingOn && isTikTok && !advertiserId) {
    throw new Error(
      "Esta cuenta no tiene advertiser_id de TikTok (external_account_id). No se puede fondear el BM.",
    );
  }

  if (fundingOn && isTikTok && advertiserId && !bcId) {
    throw new Error(
      "Falta bc_id. Poné external_business_id en la cuenta o TIKTOK_DEFAULT_BC_ID en Vercel.",
    );
  }

  // Evita mover cash en TikTok si Holistic no tiene saldo (antes: transfer OK + ledger 409).
  const wallet = await getWalletLedgerBalance(input.organizationId);
  const available = wallet?.availableBalanceCents ?? 0;
  if (available < input.amountCents) {
    throw new Error(
      `Insufficient wallet balance. available=${available}, requested=${input.amountCents}. Recargá la cartera Holistic del cliente antes de asignar.`,
    );
  }

  if (canFund) {
    transferRequestId = `bc:${idempotencyKey}`;
    const cashAmount = input.amountCents / 100;
    const transfer = await transferBcFundsToAdvertiser({
      organizationId: input.organizationId,
      bcId,
      advertiserId,
      cashAmount,
      requestId: transferRequestId,
      transferType: "RECHARGE",
    });
    tiktokRequestId = transfer.tiktokRequestId;
  }

  const journalId = await allocateToAdAccount({
    organizationId: input.organizationId,
    adAccountId: input.adAccountId,
    amountCents: input.amountCents,
    idempotencyKey,
    description: input.description ?? "Asignación desde dashboard",
    metadata: {
      source: "dashboard",
      requested_by: input.requestedBy,
      currency: input.currency ?? account.currency ?? "USD",
      tiktok_bc_funding_enabled: fundingOn,
      tiktok_bc_transfer_attempted: canFund,
      tiktok_bc_id: bcId || null,
      tiktok_advertiser_id: advertiserId || null,
      tiktok_transfer_request_id: transferRequestId,
      tiktok_api_request_id: tiktokRequestId,
    },
  });

  return {
    journalId,
    tiktokTransfer: {
      attempted: canFund,
      requestId: transferRequestId,
      tiktokRequestId,
      bcId: bcId || null,
      advertiserId: advertiserId || null,
    },
  };
}
