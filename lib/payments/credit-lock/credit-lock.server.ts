import "server-only";
import { STRIPE_PAYMENTS_ENABLED } from "../stripe-policy";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { resolveHecomBillingModality } from "@/lib/hecom/clientes.server";
import {
  finalizeStripeCardSetup,
  startStripeCardSetup,
} from "@/lib/payments/credit-card/credit-card.server";
import {
  getAutochargeStatus,
  getCreditCardMethod,
  isChargeableCard,
  markCreditCardDetached,
} from "@/lib/payments/credit-card/credit-card.store.server";
import {
  getCreditLockProfile,
  setCreditLockApproval,
  upsertCreditLockProfile,
  type CreditLockApprovalStatus,
} from "@/lib/payments/credit-lock/credit-lock.store.server";

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

/**
 * Crédito Holistic + candado Stripe. Apagado para siempre junto con Stripe.
 * Env: CREDIT_STRIPE_LOCK_ENABLED=true
 */
export const CREDIT_STRIPE_LOCK_ENABLED = STRIPE_PAYMENTS_ENABLED && parseBoolean(
  process.env.CREDIT_STRIPE_LOCK_ENABLED,
  false,
);

/**
 * Crédito Holistic + tarjeta guardada en Stripe (anti-vivos; antes Whop, suspendido 21/10/2026).
 * Env: CREDIT_CARD_LOCK_ENABLED=true. El cobro semanal va aparte
 * (CREDIT_AUTOCHARGE_MODE, ver lib/payments/credit-card).
 */
export const CREDIT_CARD_LOCK_ENABLED = parseBoolean(
  process.env.CREDIT_CARD_LOCK_ENABLED,
  false,
);

/**
 * Mostrar “¿Quieres crédito?”, pedir crédito y registrar tarjeta. No bloquea
 * el fondeo (eso es CREDIT_CARD_LOCK_ENABLED). Para esconderlo:
 * CREDIT_CARD_SIGNUP_ENABLED=false.
 */
export const CREDIT_CARD_SIGNUP_ENABLED =
  CREDIT_CARD_LOCK_ENABLED ||
  parseBoolean(process.env.CREDIT_CARD_SIGNUP_ENABLED, true);

/** Con deuda desde este monto no se puede quitar la tarjeta. */
const DETACH_MAX_DEBT_CENTS = 100;

/** Cupo mínimo / máximo que se puede pedir (USD). */
export const CREDIT_REQUEST_MIN_USD = 50;
export const CREDIT_REQUEST_MAX_USD = 50_000;

/** Default: tarjeta “un poco más” que el cupo (+15%). */
export const CREDIT_CARD_HEADROOM_PERCENT = 15;

/** Default: pausar fondeo al 90% del cupo. */
export const CREDIT_SOFT_CAP_PERCENT = 90;

export function recommendedCardCents(
  requestedCreditCents: number,
  headroomPercent = CREDIT_CARD_HEADROOM_PERCENT,
): number {
  return Math.ceil(requestedCreditCents * (1 + headroomPercent / 100));
}

export type CreditLockDebt = {
  saldoEstimado: number;
  debtUsd: number;
  debtCents: number;
};

/**
 * Deuda viva Hecom ≈ −saldoEstimado (cobros − gastos − fees).
 * Positivo = debe; 0 = al día / a favor.
 */
export async function getCreditLockDebt(
  hecomClienteId: string,
): Promise<CreditLockDebt> {
  const data = await getHecomClienteDashboard(hecomClienteId, {
    includeCampaignSpend: false,
    includeCreativos: false,
    includeDailySpend: false,
  });
  if (!data) {
    throw new Error("No se pudo cargar el saldo Hecom del cliente.");
  }
  const saldoEstimado = Number(data.summary.saldoEstimado ?? 0);
  const debtUsd = saldoEstimado < 0 ? Math.abs(saldoEstimado) : 0;
  const debtCents = Math.round(debtUsd * 100);
  return { saldoEstimado, debtUsd, debtCents };
}

export async function getCreditLockState(input: {
  organizationId: string;
  hecomClienteId: string | null;
}) {
  const [card, profile, autocharge] = await Promise.all([
    getCreditCardMethod(input.organizationId),
    getCreditLockProfile(input.organizationId),
    getAutochargeStatus(input.organizationId),
  ]);
  const paymentMethod = isChargeableCard(card)
    ? {
        brand: card.card_brand,
        last4: card.card_last4,
        expMonth: card.card_exp_month,
        expYear: card.card_exp_year,
      }
    : null;

  let billingModality: "credito" | "prepago" | "unknown" = "unknown";
  if (input.hecomClienteId) {
    const data = await getHecomClienteDashboard(input.hecomClienteId, {
      includeCampaignSpend: false,
      includeCreativos: false,
      includeDailySpend: false,
    });
    if (data) {
      billingModality = resolveHecomBillingModality(data.cliente);
    }
  }

  const requestedCreditCents = profile?.requested_credit_cents ?? null;
  const approvalStatus: CreditLockApprovalStatus =
    profile?.approval_status ??
    (requestedCreditCents != null ? "requested" : "none");
  const headroom =
    profile?.card_headroom_percent != null
      ? Number(profile.card_headroom_percent)
      : CREDIT_CARD_HEADROOM_PERCENT;
  const softCap =
    profile?.soft_cap_percent != null
      ? Number(profile.soft_cap_percent)
      : CREDIT_SOFT_CAP_PERCENT;
  const approved = approvalStatus === "approved";
  const hasCard = paymentMethod != null;

  return {
    enabled: CREDIT_CARD_SIGNUP_ENABLED,
    billingModality,
    paymentMethod,
    /** Último cobro automático rechazado (sin el monto: eso es interno). */
    autocharge: {
      failed: Boolean(autocharge.failedSince),
      failedSince: autocharge.failedSince,
      frozen: Boolean(autocharge.frozenAt),
    },
    /** No exponer deuda / cobro al detach al cliente (interno). */
    cupo: {
      approvalStatus,
      requestedCreditCents,
      requestedCreditUsd:
        requestedCreditCents != null ? requestedCreditCents / 100 : null,
      cardHeadroomPercent: headroom,
      recommendedCardCents:
        requestedCreditCents != null
          ? recommendedCardCents(requestedCreditCents, headroom)
          : null,
      recommendedCardUsd:
        requestedCreditCents != null
          ? recommendedCardCents(requestedCreditCents, headroom) / 100
          : null,
      softCapPercent: softCap,
      requireCard: profile?.require_card ?? true,
      hasCard,
      /** Listo solo si gerencia aprobó + tarjeta. */
      lockReady: approved && hasCard && requestedCreditCents != null,
      canLinkCard: approved,
      requestedAt: profile?.requested_at ?? null,
      reviewedAt: profile?.reviewed_at ?? null,
    },
  };
}

export async function saveCreditLockCupo(input: {
  organizationId: string;
  hecomClienteId: string | null;
  requestedCreditUsd: number;
}): Promise<Awaited<ReturnType<typeof getCreditLockState>>["cupo"]> {
  if (!CREDIT_CARD_SIGNUP_ENABLED) {
    throw new Error("El crédito con tarjeta está desactivado.");
  }
  const usd = Number(input.requestedCreditUsd);
  if (!Number.isFinite(usd)) {
    throw new Error("Monto de crédito inválido.");
  }
  if (usd < CREDIT_REQUEST_MIN_USD) {
    throw new Error(`El crédito mínimo es $${CREDIT_REQUEST_MIN_USD} USD.`);
  }
  if (usd > CREDIT_REQUEST_MAX_USD) {
    throw new Error(`El crédito máximo es $${CREDIT_REQUEST_MAX_USD} USD.`);
  }
  const cents = Math.round(usd * 100);
  const existing = await getCreditLockProfile(input.organizationId);
  // Si ya estaba aprobado y solo cambia monto → vuelve a “requested” (re-aprobación).
  const nextStatus: CreditLockApprovalStatus =
    existing?.approval_status === "approved" &&
    existing.requested_credit_cents === cents
      ? "approved"
      : "requested";

  await upsertCreditLockProfile({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId,
    requestedCreditCents: cents,
    cardHeadroomPercent: CREDIT_CARD_HEADROOM_PERCENT,
    softCapPercent: CREDIT_SOFT_CAP_PERCENT,
    requireCard: true,
    approvalStatus: nextStatus,
    requestedAt: new Date().toISOString(),
    reviewedAt: nextStatus === "approved" ? existing?.reviewed_at ?? null : null,
    reviewedBy: nextStatus === "approved" ? existing?.reviewed_by ?? null : null,
  });

  const state = await getCreditLockState({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId,
  });
  return state.cupo;
}

export async function reviewCreditLockRequest(input: {
  organizationId: string;
  hecomClienteId: string | null;
  decision: "approved" | "rejected";
  reviewedBy: string;
  notes?: string | null;
}): Promise<Awaited<ReturnType<typeof getCreditLockState>>["cupo"]> {
  const profile = await getCreditLockProfile(input.organizationId);
  if (!profile?.requested_credit_cents) {
    throw new Error("No hay un pedido de crédito para revisar.");
  }
  await setCreditLockApproval({
    organizationId: input.organizationId,
    status: input.decision,
    reviewedBy: input.reviewedBy,
    notes: input.notes,
  });
  const state = await getCreditLockState({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId,
  });
  return state.cupo;
}

/**
 * Tope suave + tarjeta Stripe para fondeo a crédito (cash BM / cupo).
 * NO bloquea:
 * - asignación desde cartera Holistic ya pagada (Whop/Yape/BCP/cripto)
 * - recarga BM hecha por gerente/staff (ops Holistic)
 */
export async function assertCreditLockAllowsAllocate(input: {
  organizationId: string;
  hecomClienteId: string | null | undefined;
  amountCents: number;
  /** Solo se aplica el candado cuando el fondeo es a crédito BM, no cartera prepago. */
  agencyBmFunding?: boolean;
  /**
   * Gerente/staff fondeando desde BM: no exige pedido de crédito del cliente.
   * El candado es para el flujo cliente-crédito + tarjeta, no para ops.
   */
  staffBmFunding?: boolean;
}): Promise<void> {
  if (!CREDIT_CARD_LOCK_ENABLED) return;
  // Recarga ya pagada en cartera → el cliente puede asignar a TikTok sin candado.
  if (!input.agencyBmFunding) return;
  // Ops Holistic recargan BM sin pasar por el pedido de crédito del cliente.
  if (input.staffBmFunding) return;

  const hecomId = input.hecomClienteId?.trim();
  if (!hecomId) return;

  const data = await getHecomClienteDashboard(hecomId, {
    includeCampaignSpend: false,
    includeCreativos: false,
    includeDailySpend: false,
  });
  if (!data) return;
  if (resolveHecomBillingModality(data.cliente) !== "credito") return;

  const [profile, card, autocharge] = await Promise.all([
    getCreditLockProfile(input.organizationId),
    getCreditCardMethod(input.organizationId),
    getAutochargeStatus(input.organizationId),
  ]);

  const approval = profile?.approval_status ?? "none";
  if (approval !== "approved") {
    throw new Error(
      approval === "requested"
        ? "Tu pedido de crédito Holistic está en revisión. Gerencia debe aceptarlo antes de fondear."
        : "Pide crédito Holistic en Pagos y espera la aceptación de gerencia antes de fondear desde BM.",
    );
  }

  const requireCard = profile?.require_card ?? true;
  if (requireCard && !isChargeableCard(card)) {
    throw new Error(
      "El crédito necesita tu tarjeta: regístrala en Pagos antes de fondear desde BM.",
    );
  }

  // Cobro rechazado: no sube la deuda hasta que pague.
  if (autocharge.failedSince) {
    throw new Error(
      "Tu último cobro automático fue rechazado. Paga tu deuda o cambia tu tarjeta en Pagos para volver a fondear a crédito.",
    );
  }

  const requested = profile?.requested_credit_cents;
  if (requested == null || requested <= 0) {
    throw new Error(
      "Indica el monto de crédito solicitado (USD) en Pagos antes de fondear desde BM.",
    );
  }

  const softCapPercent = Number(
    profile?.soft_cap_percent ?? CREDIT_SOFT_CAP_PERCENT,
  );
  const softCapCents = Math.floor((requested * softCapPercent) / 100);

  const saldoEstimado = Number(data.summary.saldoEstimado ?? 0);
  const exposureCents =
    saldoEstimado < 0 ? Math.round(Math.abs(saldoEstimado) * 100) : 0;
  const nextExposure = exposureCents + Math.max(0, input.amountCents);

  if (nextExposure > softCapCents) {
    throw new Error(
      `Tope suave del cupo crédito ($${softCapCents / 100} = ${softCapPercent}% de $${requested / 100}). ` +
        `Exposición actual ~$${exposureCents / 100}. Paga el ciclo o pide ampliar cupo.`,
    );
  }
}

/**
 * Abre Stripe para guardar la tarjeta. Solo con crédito aprobado y con la
 * autorización del cobro automático aceptada en Pagos.
 */
export async function startCreditLockSetupSession(input: {
  organizationId: string;
  hecomClienteId: string | null;
  userId: string;
  customerEmail: string;
  consentAccepted: boolean;
}): Promise<{ checkoutUrl: string }> {
  if (!CREDIT_CARD_SIGNUP_ENABLED) {
    throw new Error("El crédito con tarjeta está desactivado.");
  }
  if (!input.consentAccepted) {
    throw new Error("Acepta la autorización del cobro automático para registrar la tarjeta.");
  }
  const profile = await getCreditLockProfile(input.organizationId);
  if (profile?.approval_status !== "approved") {
    throw new Error(
      profile?.approval_status === "requested"
        ? "Gerencia aún no aceptó tu pedido de crédito. Cuando lo aprueben, podrás registrar la tarjeta."
        : "Primero pide crédito Holistic y espera la aceptación de gerencia.",
    );
  }
  return startStripeCardSetup({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId ?? profile.hecom_cliente_id,
    userId: input.userId,
    customerEmail: input.customerEmail,
  });
}

export async function finalizeCreditLockSetup(input: {
  sessionId: string;
  organizationId: string;
}): Promise<{ saved: boolean }> {
  const result = await finalizeStripeCardSetup({
    sessionId: input.sessionId,
    expectedOrganizationId: input.organizationId,
  });
  return { saved: result.saved };
}

/**
 * Quita la tarjeta. Con deuda no se puede: el cobro automático la cobra y
 * recién ahí se quita (si no, el vivo se iría sin pagar).
 */
export async function detachCreditLockPaymentMethod(input: {
  organizationId: string;
  hecomClienteId: string;
  userId: string;
}): Promise<{ detached: boolean }> {
  if (!CREDIT_CARD_SIGNUP_ENABLED) {
    throw new Error("El crédito con tarjeta está desactivado.");
  }
  const card = await getCreditCardMethod(input.organizationId);
  if (!isChargeableCard(card)) {
    throw new Error("No hay tarjeta guardada para quitar.");
  }
  const debt = await getCreditLockDebt(input.hecomClienteId);
  if (debt.debtCents >= DETACH_MAX_DEBT_CENTS) {
    throw new Error("CREDIT_LOCK_DETACH_HAS_DEBT");
  }
  await markCreditCardDetached(input.organizationId);
  return { detached: true };
}
