import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allocateToAdAccount,
  confirmDepositInLedger,
  getWalletLedgerBalance,
  refundAdAccountToWallet,
  reverseLedgerJournal,
} from "@/lib/ledger/ledger.server";
import {
  isSharedCreditBmBucket,
  resolveBmBucketFromBcId,
  SYSTEM_ALLOCATABLE_BM_BUCKETS,
  HECOM_BM_BUCKET_TO_BC,
} from "@/lib/hecom/bm-bucket.shared";
import {
  getAdvertiserBudgetSnapshot,
  increaseSharedBmAdvertiserBudget,
  isTikTokBcFundingEnabled,
  transferBcFundsToAdvertiser,
} from "@/lib/integrations/tiktok/bc-finance.server";
import { enforceSharedBudgetCapForAdvertiser } from "@/lib/payments/enforce-shared-budget-cap.server";
import { isAgencyCreditCliente } from "@/lib/hecom/is-agency-credit-cliente.server";
import {
  assertSharedBmSpendableBeforeAllocate,
  attemptCrossBmCreditPull,
} from "@/lib/payments/cross-bm-funding.server";
import { resolveFundingBcForAdvertiser } from "@/lib/payments/resolve-funding-bc.server";
import {
  assertTikTokCashMatchesCents,
  usdCentsToTikTokCashAmount,
} from "@/lib/payments/tiktok-transfer-amount";
import {
  createPaymentIntentRecord,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { isStaffBlockedAdAccount } from "@/lib/payments/staff-block.server";
import { isRecord } from "@/lib/records";

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
  /** Gerente/staff: no aplicar candado de crédito del cliente. */
  staffBmFunding?: boolean;
  /**
   * Gerente: intenta jalar crédito de otro BM (ej. BM30 → BM10) vía Multi-tier BC
   * antes de subir presupuesto. Requiere TIKTOK_MULTI_TIER_BC_ENABLED + allowlist TikTok.
   */
  crossBmFunding?: boolean;
  /** BC origen para crossBmFunding. Default: BM 30 (Holistic PE). */
  crossBmSourceBcId?: string;
}

export interface AllocateWithTikTokResult {
  journalId: string;
  agencyBmFunding: boolean;
  /**
   * TikTok aceptó el fondeo pero la lectura posterior no lo confirmó a tiempo.
   * La cartera ya está debitada: NO reintentar (fondearía dos veces); revisar.
   */
  pendingVerification: boolean;
  /** La idempotencyKey ya estaba asentada: no se volvió a llamar a TikTok. */
  replayed: boolean;
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
 * Cliente: débito atómico del ledger (cartera → cuenta ads) → TikTok BC.
 * Gerente (agencyBmFunding): puente contable → débito ledger → TikTok BC.
 * Si TikTok rechaza, se devuelve la plata a la cartera y se revierte el
 * puente. El ledger va primero porque su débito es atómico: con TikTok
 * primero, dos asignaciones simultáneas (o un reintento) fondeaban TikTok
 * dos veces con un solo débito.
 */
export async function allocateWithOptionalTikTokFunding(
  input: AllocateWithTikTokInput,
): Promise<AllocateWithTikTokResult> {
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("ad_accounts")
    .select("id, organization_id, platform, external_account_id, external_business_id, currency, status, metadata")
    .eq("id", input.adAccountId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      platform: string | null;
      external_account_id: string | null;
      external_business_id: string | null;
      currency: string | null;
      status: string | null;
      metadata: unknown;
    }>();

  if (error) throw new Error(error.message);
  if (!account || account.organization_id !== input.organizationId) {
    throw new Error("Cuenta publicitaria no encontrada en la organización.");
  }

  if (
    isStaffBlockedAdAccount({
      status: account.status,
      metadata: account.metadata,
      externalAccountId: account.external_account_id,
      hecomClienteId: isRecord(account.metadata)
        ? String(account.metadata.hecom_cliente_id ?? "")
        : null,
    })
  ) {
    throw new Error(
      "Esta cuenta está bloqueada por staff y no se puede recargar.",
    );
  }

  const hecomClienteId = isRecord(account.metadata)
    ? String(account.metadata.hecom_cliente_id ?? "").trim() || null
    : null;
  const { assertCreditLockAllowsAllocate } = await import(
    "@/lib/payments/credit-lock/credit-lock.server"
  );
  await assertCreditLockAllowsAllocate({
    organizationId: input.organizationId,
    hecomClienteId,
    amountCents: input.amountCents,
    agencyBmFunding: Boolean(input.agencyBmFunding),
    staffBmFunding: Boolean(input.staffBmFunding),
  });

  const idempotencyKey =
    input.idempotencyKey ??
    `allocation:${input.organizationId}:${input.adAccountId}:${input.amountCents}:${randomUUID()}`;

  const currency = (input.currency ?? account.currency ?? "USD").toUpperCase();
  const advertiserId = account.external_account_id?.trim() || "";
  // Si en DB quedó "200"/"10"/"30" (label Hecom) → BC real TikTok.
  // Si falta external_business_id: Hecom bm_bucket o probe TikTok (evita caer a BM200 cash).
  const rawBusinessId = account.external_business_id?.trim() || "";
  const fundingBc = await resolveFundingBcForAdvertiser({
    rawBusinessId,
    advertiserId,
    hecomClienteId,
    organizationId: input.organizationId,
  });
  const bcId = fundingBc.bcId.trim();
  const bmBucket = fundingBc.bmBucket ?? (bcId ? resolveBmBucketFromBcId(bcId) : null);

  if (
    bcId &&
    advertiserId &&
    (!rawBusinessId || rawBusinessId !== bcId)
  ) {
    await createAdminClient()
      .from("ad_accounts")
      .update({
        external_business_id: bcId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .then(({ error }) => {
        if (error) {
          console.warn("[payments/allocate] backfill_bc_failed", {
            adAccountId: account.id,
            bcId,
            error: error.message,
          });
        }
      });
  }

  const fundingOn = isTikTokBcFundingEnabled();
  const isTikTok = (account.platform ?? "tiktok").toLowerCase() === "tiktok";
  const canFund = fundingOn && isTikTok && Boolean(advertiserId) && Boolean(bcId);
  const agencyBmFunding = Boolean(input.agencyBmFunding);

  let tiktokRequestId: string | null = null;
  let transferRequestId: string | null = null;
  let bridgeJournalId: string | null = null;
  let tiktokFundingSource: "cash" | "grant" | "shared_budget" | null = null;
  let tiktokBudgetBefore: number | null = null;
  let tiktokBudgetAfter: number | null = null;

  if (fundingOn && isTikTok && !advertiserId) {
    throw new Error(
      "Esta cuenta no tiene advertiser_id de TikTok (external_account_id). No se puede recargar el BM.",
    );
  }

  if (fundingOn && isTikTok && advertiserId && !bcId) {
    throw new Error(
      "Falta bc_id. Agrega external_business_id en la cuenta o TIKTOK_DEFAULT_BC_ID en Vercel.",
    );
  }

  if (
    canFund &&
    bmBucket &&
    !(SYSTEM_ALLOCATABLE_BM_BUCKETS as readonly string[]).includes(bmBucket)
  ) {
    throw new Error(
      "Esta cuenta no se puede recargar desde Holistic. Contacta con soporte.",
    );
  }

  const useSharedBudgetPath =
    canFund && (isSharedCreditBmBucket(bmBucket) || bmBucket === "10" || bmBucket === "30");

  console.info("[payments/allocate] resolved_targets", {
    adAccountId: account.id,
    advertiserId: advertiserId || null,
    externalBusinessIdRaw: rawBusinessId || null,
    bcId: bcId || null,
    bmBucket,
    bcSource: fundingBc.source,
    useSharedBudgetPath,
    agencyBmFunding,
    fundingOn,
  });

  // Reintento con la misma idempotencyKey: el ledger devolvería el journal
  // anterior sin debitar de nuevo. Si llamáramos a TikTok otra vez, la cuenta
  // quedaría fondeada dos veces con un solo débito. Cortamos aquí.
  const previousAllocation = await findAllocationJournalByKey(
    input.organizationId,
    idempotencyKey,
  );
  if (previousAllocation) {
    return await resolveReplayedAllocation({
      organizationId: input.organizationId,
      idempotencyKey,
      journal: previousAllocation,
      agencyBmFunding,
      canFund,
      bcId,
      advertiserId,
    });
  }

  // Cliente: aviso temprano con mensaje claro. NO es la garantía: dos
  // peticiones pueden pasar este chequeo a la vez; la que manda es el débito
  // atómico de ledger_allocate_to_ad_account más abajo.
  if (!agencyBmFunding) {
    const wallet = await getWalletLedgerBalance(input.organizationId);
    const available = wallet?.availableBalanceCents ?? 0;
    if (available < input.amountCents) {
      throw new Error(
        `Insufficient wallet balance. available=${available}, requested=${input.amountCents}. Recarga la cartera Holistic del cliente antes de asignar.`,
      );
    }
  }

  // Lecturas previas a TikTok (no mueven plata): se hacen antes del débito
  // para no ensuciar el historial del cliente con asignación + reverso cuando
  // ya sabemos que TikTok no tiene cupo.
  const willCrossBmPull =
    canFund &&
    useSharedBudgetPath &&
    agencyBmFunding &&
    Boolean(input.crossBmFunding) &&
    bmBucket === "10";
  const cashAmount = canFund ? usdCentsToTikTokCashAmount(input.amountCents) : 0;
  if (canFund) {
    assertTikTokCashMatchesCents(cashAmount, input.amountCents);
  }
  let beforeCash: number | null = null;
  if (canFund && useSharedBudgetPath && !willCrossBmPull) {
    await assertSharedBmSpendableBeforeAllocate({
      bcId,
      advertiserId,
      amountUsd: cashAmount,
      organizationId: input.organizationId,
    });
  } else if (canFund && !useSharedBudgetPath) {
    const beforeCashSnap = await getAdvertiserBudgetSnapshot({
      bcId,
      advertiserId,
      organizationId: input.organizationId,
    });
    beforeCash =
      beforeCashSnap?.validCashBalance ??
      beforeCashSnap?.cashBalance ??
      null;
  }

  if (!canFund && agencyBmFunding) {
    throw new Error(
      "Modo gerente requiere TikTok BC funding activo (advertiser + bc_id + TIKTOK_BC_FUNDING_ENABLED).",
    );
  }

  // LEDGER PRIMERO. ledger_allocate_to_ad_account bloquea la cartera (FOR
  // UPDATE) y falla si no alcanza: dos asignaciones simultáneas ya no pueden
  // pasar el chequeo de saldo y fondear TikTok dos veces con un solo débito.
  // Gerente: el puente acredita la cartera justo antes para que el débito pase.
  if (agencyBmFunding) {
    bridgeJournalId = await ensureAgencyBmBridgeCredit({
      organizationId: input.organizationId,
      amountCents: input.amountCents,
      requestedBy: input.requestedBy,
      currency,
      idempotencyKey,
    });
  }

  if (canFund) {
    transferRequestId = `bc:${idempotencyKey}`;
  }

  // Marca de este intento: si otra petición con la misma clave ganó la
  // carrera, el RPC devuelve SU journal y no debita; lo detectamos por aquí.
  const attemptId = randomUUID();
  let journalId: string;
  try {
    journalId = await allocateToAdAccount({
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
        allocation_attempt_id: attemptId,
        agency_bm_funding: agencyBmFunding,
        agency_bm_bridge_journal_id: bridgeJournalId,
        tiktok_bc_funding_enabled: fundingOn,
        tiktok_bc_transfer_attempted: canFund,
        tiktok_bc_id: bcId || null,
        tiktok_advertiser_id: advertiserId || null,
        tiktok_cash_amount_usd: canFund ? cashAmount : null,
        tiktok_funding_path: canFund
          ? useSharedBudgetPath
            ? "shared_budget"
            : "cash_transfer"
          : null,
        tiktok_amount_cents: input.amountCents,
        tiktok_transfer_request_id: transferRequestId,
      },
    });
  } catch (allocateError) {
    await rollbackAgencyBmBridge({
      bridgeJournalId,
      idempotencyKey,
      cause: allocateError,
    });
    throw allocateError;
  }

  const allocationJournal = await findAllocationJournalByKey(
    input.organizationId,
    idempotencyKey,
  );
  const ownAttempt =
    allocationJournal?.id === journalId &&
    allocationJournal.metadata?.allocation_attempt_id === attemptId;
  if (!ownAttempt) {
    // Otra petición con la misma clave asentó (y fondea) esta asignación.
    // El puente es idempotente por clave: es el mismo journal, no se revierte.
    return await resolveReplayedAllocation({
      organizationId: input.organizationId,
      idempotencyKey,
      journal: allocationJournal ?? { id: journalId, metadata: null },
      agencyBmFunding,
      canFund,
      bcId,
      advertiserId,
    });
  }

  // TikTok DESPUÉS del débito. Si TikTok rechaza, devolvemos la plata a la
  // cartera (y revertimos el puente gerente) con claves derivadas de la
  // asignación, así un reintento del reverso no duplica la devolución.
  // BM 200 (NON_SHARED): cash_amount transfer 1:1
  // BM 10/30 (SHARED): INCREASE_BUDGET — gasta de la línea de crédito
  let pendingVerification = false;
  if (canFund) {
    try {
      if (useSharedBudgetPath) {
        if (willCrossBmPull) {
          const sourceBcId =
            input.crossBmSourceBcId?.trim() ||
            HECOM_BM_BUCKET_TO_BC["30"];
          await attemptCrossBmCreditPull({
            sourceBcId,
            targetBcId: bcId,
            amountUsd: cashAmount,
            organizationId: input.organizationId,
            requestId: `cross-bm:${idempotencyKey}`.padEnd(32, "0").slice(0, 32),
          });
          await assertSharedBmSpendableBeforeAllocate({
            bcId,
            advertiserId,
            amountUsd: cashAmount,
            organizationId: input.organizationId,
          });
        }

        const budgetResult = await increaseSharedBmAdvertiserBudget({
          organizationId: input.organizationId,
          bcId,
          advertiserId,
          increaseAmountUsd: cashAmount,
        });
        tiktokRequestId = budgetResult.tiktokRequestId;
        tiktokFundingSource = "shared_budget";
        tiktokBudgetBefore = budgetResult.previousBudget;
        tiktokBudgetAfter = budgetResult.newBudget;
        pendingVerification = budgetResult.pendingVerification;
      } else {
        const transfer = await transferBcFundsToAdvertiser({
          organizationId: input.organizationId,
          bcId,
          advertiserId,
          cashAmount,
          requestId: transferRequestId ?? `bc:${idempotencyKey}`,
          transferType: "RECHARGE",
        });
        tiktokRequestId = transfer.tiktokRequestId;
        tiktokFundingSource = transfer.fundingSource;
      }
    } catch (tiktokError) {
      await compensateFailedTikTokFunding({
        organizationId: input.organizationId,
        adAccountId: input.adAccountId,
        amountCents: input.amountCents,
        idempotencyKey,
        allocationJournalId: journalId,
        bridgeJournalId,
        requestedBy: input.requestedBy,
        cause: tiktokError,
      });
      throw tiktokError;
    }

    // BM 200: confirmar que el cash llegó (si podemos leer el advertiser).
    // Aquí TikTok YA aceptó la transferencia: no se compensa ni se lanza
    // error, porque el cliente reintentaría y fondearía dos veces. Se marca
    // como pendiente de verificación para que soporte lo revise.
    if (
      !useSharedBudgetPath &&
      beforeCash != null &&
      tiktokFundingSource === "cash"
    ) {
      const expectedCash = Math.round((beforeCash + cashAmount) * 100) / 100;
      let cashOk = false;
      let sawAfter = false;
      const delays = [0, 700, 1500, 2800];
      for (let i = 0; i < delays.length; i++) {
        if (delays[i]! > 0) {
          await new Promise((r) => setTimeout(r, delays[i]));
        }
        const after = await getAdvertiserBudgetSnapshot({
          bcId,
          advertiserId,
          organizationId: input.organizationId,
        }).catch(() => null);
        const live =
          after?.validCashBalance ?? after?.cashBalance ?? null;
        if (live == null) continue;
        sawAfter = true;
        if (live + 1e-6 >= expectedCash - 0.05) {
          cashOk = true;
          break;
        }
        console.info("[payments/allocate] bm200_cash_verify_retry", {
          attempt: i + 1,
          advertiserId,
          beforeCash,
          expectedCash,
          live,
        });
      }
      if (!cashOk && sawAfter) {
        pendingVerification = true;
        console.warn("[payments/allocate] bm200_cash_pending_verification", {
          advertiserId,
          bcId,
          beforeCash,
          cashAmount,
          tiktokRequestId,
          journalId,
          idempotencyKey,
        });
      }
      if (!cashOk && !sawAfter) {
        console.warn("[payments/allocate] bm200_cash_verify_skipped", {
          advertiserId,
          bcId,
          beforeCash,
          cashAmount,
          reason: "no_after_snapshot",
        });
      }
    }

    console.info("[payments/allocate] tiktok_funded_after_ledger", {
      journalId,
      advertiserId,
      bcId,
      tiktokFundingSource,
      tiktokRequestId,
      tiktokBudgetBefore,
      tiktokBudgetAfter,
      pendingVerification,
    });
  }

  // BM10/30 prepago: cupo TikTok = gastado + ledger.
  // Crédito agencia: no rebajar el presupuesto que puso Manager.
  const agencyCredit =
    hecomClienteId != null && (await isAgencyCreditCliente(hecomClienteId));
  if (canFund && useSharedBudgetPath && bcId && advertiserId && !agencyCredit) {
    try {
      const snap = await getAdvertiserBudgetSnapshot({
        bcId,
        advertiserId,
        organizationId: input.organizationId,
      });
      await enforceSharedBudgetCapForAdvertiser({
        organizationId: input.organizationId,
        advertiserId,
        bcId,
        currentBudgetUsd: snap?.budget ?? tiktokBudgetAfter,
        currentBudgetCostUsd: snap?.budgetCost ?? null,
        currentBudgetMode: snap?.budgetMode ?? "CUSTOM_BUDGET",
        isUnlimited: snap?.budgetMode === "UNLIMITED",
        force: true,
        adsHolisticClient: true,
      });
    } catch (capError) {
      console.error("[payments/allocate] shared_budget_cap_after_failed", {
        advertiserId,
        message:
          capError instanceof Error ? capError.message : String(capError),
      });
    }
  }

  return {
    journalId,
    agencyBmFunding,
    pendingVerification,
    replayed: false,
    tiktokTransfer: {
      attempted: canFund,
      requestId: transferRequestId,
      tiktokRequestId,
      bcId: bcId || null,
      advertiserId: advertiserId || null,
    },
  };
}

type AllocationJournalRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

/** Clave del reverso automático; determinista para que reintentar no duplique la devolución. */
function allocationCompensationKey(idempotencyKey: string): string {
  return `allocation-compensation:${idempotencyKey}`;
}

async function findAllocationJournalByKey(
  organizationId: string,
  idempotencyKey: string,
): Promise<AllocationJournalRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ledger_journals")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey)
    .limit(1)
    .maybeSingle<{ id: string; metadata: unknown }>();
  if (error) throw new Error(error.message);
  if (!data?.id) return null;
  return {
    id: data.id,
    metadata: isRecord(data.metadata) ? data.metadata : null,
  };
}

/**
 * La asignación con esta clave ya existe: no volver a tocar TikTok.
 * Si ya se había compensado (TikTok falló), se avisa en vez de dar un OK falso.
 */
async function resolveReplayedAllocation(input: {
  organizationId: string;
  idempotencyKey: string;
  journal: AllocationJournalRow;
  agencyBmFunding: boolean;
  canFund: boolean;
  bcId: string;
  advertiserId: string;
}): Promise<AllocateWithTikTokResult> {
  const compensation = await findAllocationJournalByKey(
    input.organizationId,
    allocationCompensationKey(input.idempotencyKey),
  );
  if (compensation) {
    throw new Error(
      "Esta asignación ya se intentó y TikTok no la aceptó; el saldo volvió a la cartera. Vuelve a asignar como una operación nueva.",
    );
  }

  console.warn("[payments/allocate] replay_skipped_tiktok", {
    journalId: input.journal.id,
    idempotencyKey: input.idempotencyKey,
  });

  const meta = input.journal.metadata ?? {};
  return {
    journalId: input.journal.id,
    agencyBmFunding: input.agencyBmFunding,
    pendingVerification: false,
    replayed: true,
    tiktokTransfer: {
      attempted: false,
      requestId:
        typeof meta.tiktok_transfer_request_id === "string"
          ? meta.tiktok_transfer_request_id
          : null,
      tiktokRequestId: null,
      bcId: input.bcId || null,
      advertiserId: input.advertiserId || null,
    },
  };
}

/** Revierte el puente gerente si la asignación no llegó a quedar en pie. */
async function rollbackAgencyBmBridge(input: {
  bridgeJournalId: string | null;
  idempotencyKey: string;
  cause: unknown;
}): Promise<void> {
  if (!input.bridgeJournalId) return;
  try {
    await reverseLedgerJournal({
      journalId: input.bridgeJournalId,
      reason:
        "Reverso automático: asignación falló después del puente BM gerente",
      idempotencyKey: `rollback:agency-bm-bridge:${input.bridgeJournalId}`,
    });
    console.info("[payments/allocate] bridge_rolled_back", {
      bridgeJournalId: input.bridgeJournalId,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (rollbackError) {
    console.error("[payments/allocate] bridge_rollback_failed", {
      bridgeJournalId: input.bridgeJournalId,
      cause: input.cause instanceof Error ? input.cause.message : "unknown",
      rollbackError:
        rollbackError instanceof Error ? rollbackError.message : "unknown",
    });
  }
}

/**
 * TikTok rechazó el fondeo después del débito: la plata vuelve de la cuenta
 * ads a la cartera y, en modo gerente, se revierte el puente (primero el
 * refund, porque el reverso del puente saca de la cartera lo que el refund
 * devuelve).
 */
async function compensateFailedTikTokFunding(input: {
  organizationId: string;
  adAccountId: string;
  amountCents: number;
  idempotencyKey: string;
  allocationJournalId: string;
  bridgeJournalId: string | null;
  requestedBy: string;
  cause: unknown;
}): Promise<void> {
  const causeMessage =
    input.cause instanceof Error ? input.cause.message : String(input.cause);
  try {
    const refundJournalId = await refundAdAccountToWallet({
      organizationId: input.organizationId,
      adAccountId: input.adAccountId,
      amountCents: input.amountCents,
      idempotencyKey: allocationCompensationKey(input.idempotencyKey),
      description: "Reverso automático: TikTok no aceptó la asignación",
      metadata: {
        source: "allocation_compensation",
        requested_by: input.requestedBy,
        allocation_journal_id: input.allocationJournalId,
        allocation_idempotency_key: input.idempotencyKey,
        tiktok_error: causeMessage.slice(0, 500),
      },
    });
    console.info("[payments/allocate] allocation_compensated", {
      allocationJournalId: input.allocationJournalId,
      refundJournalId,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (refundError) {
    // Sin refund no se revierte el puente: la cartera no tendría con qué.
    // Queda debitado y sin TikTok; soporte debe devolverlo a mano.
    console.error("[payments/allocate] allocation_compensation_failed", {
      allocationJournalId: input.allocationJournalId,
      bridgeJournalId: input.bridgeJournalId,
      idempotencyKey: input.idempotencyKey,
      cause: causeMessage,
      refundError:
        refundError instanceof Error ? refundError.message : "unknown",
    });
    throw new Error(
      `${causeMessage} Además no se pudo devolver el saldo a la cartera automáticamente; contacta a soporte (ref. ${input.allocationJournalId}).`,
    );
  }

  await rollbackAgencyBmBridge({
    bridgeJournalId: input.bridgeJournalId,
    idempotencyKey: input.idempotencyKey,
    cause: input.cause,
  });
}
