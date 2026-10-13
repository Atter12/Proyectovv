import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { loPagadoPublicUrl } from "@/lib/hecom/lo-pagado-public-token";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import { resolveManualPaymentManagerEmails } from "@/lib/email/manual-payment-notify.server";
import { escapeHtml, wrapHolisticEmail, wrapInternalEmail } from "@/lib/email/templates/layout";
import {
  createPaymentIntentRecord,
  updatePaymentIntentRecord,
  type PaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { parseWhopSavedCard } from "@/lib/payments/providers/whop-webhook";
import type { SavedCardEvent } from "@/lib/payments/providers/types";
import {
  AUTOCHARGE_CONSENT_TEXT,
  AUTOCHARGE_MIN_CENTS,
  AUTOCHARGE_PENDING_MAX_HOURS,
  autochargeAmounts,
  buildWhopCardSetupBody,
  buildWhopOffSessionPaymentBody,
  decideAutocharge,
  limaDateKey,
  resolveAutochargeMode,
  type AutochargeAction,
  type AutochargeMode,
} from "@/lib/payments/credit-card/autocharge";
import {
  getAutochargeStatus,
  getCreditCardMethod,
  isChargeableCard,
  listApprovedCreditProfiles,
  updateAutochargeStatus,
  upsertCreditCardMethod,
  type AutochargeProfileRow,
} from "@/lib/payments/credit-card/credit-card.store.server";

/** `source` de los intents del cobro automático. */
export const AUTOCHARGE_SOURCE = "credito_cobro_auto";
const SYSTEM_ORDERED_BY = "Sistema anti-vivos";
const SETUP_PURPOSE = "credito_tarjeta";
const WHOP_TIMEOUT_MS = 20_000;

function whopReady(): boolean {
  return Boolean(serverEnv.whopApiKey && serverEnv.whopCompanyId);
}

async function whopRequest(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${serverEnv.whopApiBaseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${serverEnv.whopApiKey}`,
      Accept: "application/json",
      "Api-Version-Date": serverEnv.whopApiVersionDate,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(WHOP_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const err = data?.error;
    const message =
      err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : typeof data?.message === "string"
          ? data.message
          : `Whop respondió ${response.status}.`;
    throw new Error(message);
  }
  return data ?? {};
}

async function resolveWalletId(organizationId: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Cartera no encontrada.");
  return data.id;
}

async function userEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string | null }>();
  return data?.email?.trim() || null;
}

function debtLink(hecomClienteId: string): string | null {
  const secret = serverEnv.holisticWaSnapshotSecret;
  return secret ? loPagadoPublicUrl(hecomClienteId, secret) : null;
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Guardar tarjeta ─────────────────────────────────────────────────────────

/** Abre el checkout de Whop que guarda la tarjeta (no cobra). */
export async function startWhopCardSetup(input: {
  organizationId: string;
  hecomClienteId: string | null;
  userId: string;
}): Promise<{ checkoutUrl: string }> {
  if (!whopReady()) throw new Error("Whop no está configurado.");
  const body = buildWhopCardSetupBody({
    companyId: serverEnv.whopCompanyId,
    redirectUrl: `${serverEnv.appUrl.replace(/\/$/, "")}/payments?billing_setup=whop`,
    metadata: {
      purpose: SETUP_PURPOSE,
      organization_id: input.organizationId,
      hecom_cliente_id: input.hecomClienteId ?? "",
      consent_by: input.userId,
      consent_at: new Date().toISOString(),
    },
  });
  const data = await whopRequest("POST", "/checkout_configurations", body);
  const raw = typeof data.purchase_url === "string" ? data.purchase_url.trim() : "";
  if (!raw) throw new Error("Whop no devolvió el enlace para guardar la tarjeta.");
  return { checkoutUrl: /^https?:\/\//i.test(raw) ? raw : `https://whop.com${raw.startsWith("/") ? "" : "/"}${raw}` };
}

/**
 * Guarda la tarjeta que llegó de Whop. Solo la del checkout que abrimos
 * nosotros (purpose + organización) y solo si gerencia aprobó el crédito.
 */
export async function saveWhopCardFromSetup(
  card: SavedCardEvent,
  expectedOrganizationId?: string,
): Promise<{ saved: boolean; reason?: string }> {
  const meta = card.metadata;
  if (meta.purpose !== SETUP_PURPOSE) return { saved: false, reason: "otro_checkout" };
  const organizationId = typeof meta.organization_id === "string" ? meta.organization_id : "";
  if (!organizationId) return { saved: false, reason: "sin_organizacion" };
  if (expectedOrganizationId && expectedOrganizationId !== organizationId) {
    throw new Error("La tarjeta no corresponde a tu organización.");
  }
  const hecomClienteId =
    typeof meta.hecom_cliente_id === "string" && meta.hecom_cliente_id ? meta.hecom_cliente_id : null;
  const consentBy = typeof meta.consent_by === "string" && meta.consent_by ? meta.consent_by : null;
  const consentAt = typeof meta.consent_at === "string" && meta.consent_at ? meta.consent_at : null;

  await upsertCreditCardMethod({
    organizationId,
    hecomClienteId,
    memberId: card.memberId,
    paymentMethodId: card.paymentMethodId,
    setupIntentId: card.setupIntentId,
    brand: card.brand,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    consentAt,
    consentBy,
    consentText: consentAt ? AUTOCHARGE_CONSENT_TEXT : null,
  });
  return { saved: true };
}

/** Vuelta del checkout: Whop manda `setup_intent_id`; se confirma contra su API. */
export async function finalizeWhopCardSetup(input: {
  setupIntentId: string;
  organizationId: string;
}): Promise<{ saved: boolean }> {
  if (!whopReady()) throw new Error("Whop no está configurado.");
  if (!/^sint_[A-Za-z0-9]+$/.test(input.setupIntentId)) throw new Error("Referencia de Whop inválida.");
  const data = await whopRequest("GET", `/setup_intents/${input.setupIntentId}`);
  const card = parseWhopSavedCard(data);
  // Aún procesando: el webhook la guarda cuando Whop termine.
  if (!card) return { saved: false };
  const result = await saveWhopCardFromSetup(card, input.organizationId);
  return { saved: result.saved };
}

// ── Cobro automático ────────────────────────────────────────────────────────

async function hasPendingAutocharge(organizationId: string, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - AUTOCHARGE_PENDING_MAX_HOURS * 3_600_000).toISOString();
  const { data, error } = await createAdminClient()
    .from("payment_intents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", "whop")
    .eq("metadata->>source", AUTOCHARGE_SOURCE)
    .in("status", ["created", "requires_payment", "processing"])
    .gte("created_at", since)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function chargeAttemptedToday(organizationId: string, now: Date): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("payment_intents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", `${AUTOCHARGE_SOURCE}:${organizationId}:${limaDateKey(now)}`)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Cobra la deuda a la tarjeta guardada. El resultado llega por webhook. */
async function chargeDebt(input: {
  profile: AutochargeProfileRow;
  hecomClienteId: string;
  memberId: string;
  paymentMethodId: string;
  debtCents: number;
  now: Date;
  reason: string;
}): Promise<PaymentIntentRecord> {
  const { grossCents, surchargeCents } = autochargeAmounts(
    input.debtCents,
    serverEnv.whopDepositSurchargePercent,
  );
  const organizationId = input.profile.organization_id;
  const walletId = await resolveWalletId(organizationId);
  const idempotencyKey = `${AUTOCHARGE_SOURCE}:${organizationId}:${limaDateKey(input.now)}`;

  const intent = await createPaymentIntentRecord({
    organizationId,
    walletId,
    amountCents: grossCents,
    currency: "USD",
    provider: "whop",
    createdBy: null,
    idempotencyKey,
    metadata: {
      source: AUTOCHARGE_SOURCE,
      // Paga gasto ya hecho: va a la deuda en Hecom, no a la cartera.
      purpose: "credito_lock_debt",
      skip_wallet_credit: true,
      hecom_cliente_id: input.hecomClienteId,
      debt_cents: input.debtCents,
      credit_amount_cents: input.debtCents,
      gateway_surcharge_cents: surchargeCents,
      fee_amount_cents: surchargeCents,
      gross_amount_cents: grossCents,
      autocharge_reason: input.reason,
    },
  });
  // Mismo día, segunda corrida: el intent ya existía.
  if (intent.status !== "created") return intent;

  try {
    const payment = await whopRequest(
      "POST",
      "/payments",
      buildWhopOffSessionPaymentBody({
        companyId: serverEnv.whopCompanyId,
        memberId: input.memberId,
        paymentMethodId: input.paymentMethodId,
        amountCents: grossCents,
        productId: serverEnv.whopProductId || undefined,
        metadata: {
          payment_intent_id: intent.id,
          organization_id: organizationId,
          wallet_id: walletId,
          source: AUTOCHARGE_SOURCE,
        },
      }),
      `whop:${idempotencyKey}`,
    );
    await updatePaymentIntentRecord(intent.id, {
      status: "processing",
      providerReference: typeof payment.id === "string" ? payment.id : null,
    });
    await updateAutochargeStatus(organizationId, { autocharge_last_charge_at: input.now.toISOString() });
    return { ...intent, status: "processing" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Whop rechazó el cobro.";
    await updatePaymentIntentRecord(intent.id, { status: "failed", failureReason: message.slice(0, 300) });
    await recordAutochargeFailure({ ...intent, status: "failed" }, message);
    throw error;
  }
}

// ── Rechazo, congelado y pago ───────────────────────────────────────────────

/** payment.failed de un cobro automático (o error al pedirlo). */
export async function recordAutochargeFailure(
  intent: PaymentIntentRecord,
  failureMessage: string | null,
): Promise<void> {
  const meta = (intent.metadata ?? {}) as Record<string, unknown>;
  if (meta.source !== AUTOCHARGE_SOURCE) return;
  const organizationId = intent.organizationId;
  const status = await getAutochargeStatus(organizationId);
  const now = new Date().toISOString();
  await updateAutochargeStatus(organizationId, {
    autocharge_failed_since: status.failedSince ?? now,
    autocharge_last_error: (failureMessage ?? "Cobro rechazado").slice(0, 300),
  });
  // Solo el primer rechazo avisa; los reintentos diarios no llenan el correo.
  if (status.failedSince) return;

  const hecomClienteId = typeof meta.hecom_cliente_id === "string" ? meta.hecom_cliente_id : "";
  const debtCents = Number(meta.debt_cents ?? 0);
  await notifyAutocharge({
    kind: "failed",
    organizationId,
    hecomClienteId,
    debtCents,
    detail: failureMessage,
  });
}

/** Pagó con el cobro automático: se limpia el rechazo y el congelado del sistema. */
export async function recordAutochargeSuccess(intent: PaymentIntentRecord): Promise<void> {
  const meta = (intent.metadata ?? {}) as Record<string, unknown>;
  if (meta.source !== AUTOCHARGE_SOURCE) return;
  const hecomClienteId = typeof meta.hecom_cliente_id === "string" ? meta.hecom_cliente_id : "";
  await clearAutochargeBlock(intent.organizationId, hecomClienteId, "Pagó con el cobro automático");
}

async function clearAutochargeBlock(
  organizationId: string,
  hecomClienteId: string,
  motivo: string,
): Promise<void> {
  const status = await getAutochargeStatus(organizationId);
  if (!status.failedSince && !status.frozenAt) return;
  await updateAutochargeStatus(organizationId, {
    autocharge_failed_since: null,
    autocharge_last_error: null,
    autocharge_frozen_at: null,
  });
  if (status.frozenAt && hecomClienteId) {
    const released = await releaseSystemFreeze(hecomClienteId, motivo);
    await notifyAutocharge({
      kind: "unfrozen",
      organizationId,
      hecomClienteId,
      debtCents: 0,
      detail: released
        ? "Se quitó el congelado del sistema. Hay que devolverle el cupo o el cash en TikTok."
        : "El congelado lo maneja gerencia (no lo puso el sistema): revisar a mano.",
    });
  }
}

type CobranzaRow = {
  hecom_cliente_id: string;
  estado: string;
  manual: boolean;
  ordenado_por: string | null;
};

const FROZEN_STATES = new Set(["congelado", "cobranza", "castigo"]);

/**
 * Lo marca congelado en `cliente_cobranza_estado`; el guardián de congelados
 * baja el cupo y saca el cash en TikTok. No pisa un estado que puso gerencia.
 */
async function freezeCliente(input: {
  hecomClienteId: string;
  clienteName: string;
  debtCents: number;
  lastError: string | null;
}): Promise<"frozen" | "already" | "no_table"> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cliente_cobranza_estado")
    .select("hecom_cliente_id,estado,manual,ordenado_por")
    .eq("hecom_cliente_id", input.hecomClienteId)
    .maybeSingle<CobranzaRow>();
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /cliente_cobranza_estado/i.test(error.message)) {
      return "no_table";
    }
    throw new Error(error.message);
  }
  if (data && FROZEN_STATES.has(data.estado)) return "already";

  const motivo = `Cobro automático de la tarjeta rechazado y sin pago en 48 h${
    input.lastError ? ` (${input.lastError.slice(0, 120)})` : ""
  }`;
  const deudaUsd = Math.round(input.debtCents) / 100;
  const now = new Date().toISOString();
  const { error: upErr } = await admin.from("cliente_cobranza_estado").upsert(
    {
      hecom_cliente_id: input.hecomClienteId,
      cliente_name: input.clienteName,
      estado: "congelado",
      deuda_usd: deudaUsd,
      desde: now,
      motivo,
      ordenado_por: SYSTEM_ORDERED_BY,
      registrado_por: "cron credito-cobro-auto",
      manual: false,
      updated_at: now,
    },
    { onConflict: "hecom_cliente_id" },
  );
  if (upErr) throw new Error(upErr.message);
  await admin.from("cliente_cobranza_historial").insert({
    hecom_cliente_id: input.hecomClienteId,
    estado_anterior: data?.estado ?? null,
    estado_nuevo: "congelado",
    deuda_usd: deudaUsd,
    motivo,
    ordenado_por: SYSTEM_ORDERED_BY,
    registrado_por: "cron credito-cobro-auto",
    manual: false,
  });
  return "frozen";
}

/** Solo quita el congelado que puso el sistema; el de gerencia queda. */
async function releaseSystemFreeze(hecomClienteId: string, motivo: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cliente_cobranza_estado")
    .select("hecom_cliente_id,estado,manual,ordenado_por")
    .eq("hecom_cliente_id", hecomClienteId)
    .maybeSingle<CobranzaRow>();
  if (error || !data) return false;
  if (data.estado !== "congelado" || data.manual || data.ordenado_por !== SYSTEM_ORDERED_BY) return false;
  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("cliente_cobranza_estado")
    .update({
      estado: "al_dia",
      deuda_usd: 0,
      desde: now,
      motivo,
      ordenado_por: SYSTEM_ORDERED_BY,
      registrado_por: "cron credito-cobro-auto",
      manual: false,
      updated_at: now,
    })
    .eq("hecom_cliente_id", hecomClienteId);
  if (upErr) throw new Error(upErr.message);
  await admin.from("cliente_cobranza_historial").insert({
    hecom_cliente_id: hecomClienteId,
    estado_anterior: "congelado",
    estado_nuevo: "al_dia",
    deuda_usd: 0,
    motivo,
    ordenado_por: SYSTEM_ORDERED_BY,
    registrado_por: "cron credito-cobro-auto",
    manual: false,
  });
  return true;
}

// ── Correos ─────────────────────────────────────────────────────────────────

async function notifyAutocharge(input: {
  kind: "failed" | "frozen" | "unfrozen";
  organizationId: string;
  hecomClienteId: string;
  debtCents: number;
  detail: string | null;
  clienteName?: string;
}): Promise<void> {
  try {
    const card = await getCreditCardMethod(input.organizationId);
    const clientEmail = await userEmail(card?.consent_by ?? null);
    const link = input.hecomClienteId ? debtLink(input.hecomClienteId) : null;
    const name = input.clienteName ?? input.hecomClienteId;
    const amount = usd(input.debtCents);
    const day = limaDateKey(new Date());

    if (clientEmail && input.kind !== "unfrozen") {
      const failed = input.kind === "failed";
      const title = failed ? "No pudimos cobrar a tu tarjeta" : "Tus cuentas se congelaron por falta de pago";
      const bodyHtml = failed
        ? `<p>Intentamos cobrar tu deuda de crédito Holistic de <strong>${escapeHtml(amount)}</strong> y la tarjeta la rechazó.</p>
           <p>Tienes <strong>48 horas</strong> para pagar o actualizar tu tarjeta en Pagos. Si no, tus cuentas se congelan hasta que pagues.</p>
           <p>Mientras tanto no puedes fondear más a crédito.</p>`
        : `<p>Tu deuda de crédito Holistic de <strong>${escapeHtml(amount)}</strong> sigue sin pagar y el cobro a tu tarjeta fue rechazado.</p>
           <p>Tus cuentas quedan congeladas hasta que pagues. Apenas pagues, se liberan.</p>`;
      const wrapped = wrapHolisticEmail({
        title,
        preview: title,
        bodyHtml,
        ...(link ? { ctaLabel: "Pagar mi deuda", ctaUrl: link } : {}),
      });
      await sendTransactionalEmail({
        to: clientEmail,
        subject: title,
        html: wrapped.html,
        templateKey: `credito.autocharge.${input.kind}`,
        organizationId: input.organizationId,
        idempotencyKey: `email:credito-autocharge-${input.kind}:${input.organizationId}:${day}`,
        metadata: { hecom_cliente_id: input.hecomClienteId },
      });
    }

    const managers = resolveManualPaymentManagerEmails();
    if (managers.length === 0) return;
    const label =
      input.kind === "failed"
        ? "Cobro automático rechazado"
        : input.kind === "frozen"
          ? "Congelado automático"
          : "Pagó: quitar congelado";
    const html = wrapInternalEmail({
      label,
      preview: `${label}: ${name}`,
      bodyHtml: `<p><strong>${escapeHtml(name)}</strong>${
        input.debtCents > 0 ? ` · deuda ${escapeHtml(amount)}` : ""
      }</p>${input.detail ? `<p>${escapeHtml(input.detail)}</p>` : ""}${
        input.kind === "failed" ? "<p>Tiene 48 h para pagar; si no, el sistema lo congela solo.</p>" : ""
      }${link ? `<p><a href="${escapeHtml(link)}">Link de deuda</a></p>` : ""}`,
      footerNote: "Cobro automático del crédito Holistic (anti-vivos).",
    });
    await sendTransactionalEmail({
      to: managers,
      subject: `${label}: ${name}`,
      html,
      templateKey: `credito.autocharge.managers.${input.kind}`,
      organizationId: input.organizationId,
      idempotencyKey: `email:credito-autocharge-mgr-${input.kind}:${input.organizationId}:${day}`,
      metadata: { hecom_cliente_id: input.hecomClienteId },
    });
  } catch (error) {
    console.error("[credito-autocharge] aviso no enviado", {
      kind: input.kind,
      organizationId: input.organizationId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

// ── Cron ────────────────────────────────────────────────────────────────────

export type AutochargeRunItem = {
  organizationId: string;
  hecomClienteId: string | null;
  clienteName: string | null;
  debtCents: number | null;
  hasCard: boolean;
  action: AutochargeAction | "skip";
  reason: string;
  error?: string;
};

export async function runCreditAutocharge(input: { now?: Date; mode?: AutochargeMode } = {}): Promise<{
  mode: AutochargeMode;
  items: AutochargeRunItem[];
}> {
  const mode = input.mode ?? resolveAutochargeMode(process.env.CREDIT_AUTOCHARGE_MODE);
  const now = input.now ?? new Date();
  if (mode === "off") return { mode, items: [] };

  const items: AutochargeRunItem[] = [];
  for (const profile of await listApprovedCreditProfiles()) {
    const item: AutochargeRunItem = {
      organizationId: profile.organization_id,
      hecomClienteId: profile.hecom_cliente_id,
      clienteName: null,
      debtCents: null,
      hasCard: false,
      action: "skip",
      reason: "",
    };
    items.push(item);
    try {
      if (!profile.hecom_cliente_id) {
        item.reason = "sin_cliente_hecom";
        continue;
      }
      const card = await getCreditCardMethod(profile.organization_id);
      item.hasCard = isChargeableCard(card);
      const dashboard = await getHecomClienteDashboard(profile.hecom_cliente_id, {
        includeCampaignSpend: false,
        includeCreativos: false,
        includeDailySpend: false,
      });
      if (!dashboard) {
        item.reason = "hecom_no_responde";
        continue;
      }
      item.clienteName = dashboard.cliente.name;
      const saldo = Number(dashboard.summary.saldoEstimado ?? 0);
      const debtCents = saldo < 0 ? Math.round(Math.abs(saldo) * 100) : 0;
      item.debtCents = debtCents;

      const decision = decideAutocharge({
        now,
        debtCents,
        cupoCents: profile.requested_credit_cents,
        softCapPercent: profile.soft_cap_percent,
        failedSince: profile.autocharge_failed_since ? new Date(profile.autocharge_failed_since) : null,
        frozenAt: profile.autocharge_frozen_at ? new Date(profile.autocharge_frozen_at) : null,
        pendingCharge: await hasPendingAutocharge(profile.organization_id, now),
        chargedToday: await chargeAttemptedToday(profile.organization_id, now),
      });
      item.action = decision.action;
      item.reason = decision.reason;
      if (mode === "dry_run") continue;

      if (decision.action === "clear") {
        await clearAutochargeBlock(profile.organization_id, profile.hecom_cliente_id, "Pagó su deuda");
      } else if (decision.action === "freeze") {
        const result = await freezeCliente({
          hecomClienteId: profile.hecom_cliente_id,
          clienteName: dashboard.cliente.name,
          debtCents,
          lastError: profile.autocharge_last_error,
        });
        await updateAutochargeStatus(profile.organization_id, { autocharge_frozen_at: now.toISOString() });
        await notifyAutocharge({
          kind: "frozen",
          organizationId: profile.organization_id,
          hecomClienteId: profile.hecom_cliente_id,
          debtCents,
          clienteName: dashboard.cliente.name,
          detail:
            result === "no_table"
              ? "La tabla de congelados aún no está activa: congelarlo a mano (scripts/_congelar-cliente.mjs)."
              : result === "already"
                ? "Ya estaba congelado por gerencia."
                : "Quedó congelado; el guardián le baja el cupo y saca el cash en TikTok.",
        });
      } else if (decision.action === "charge") {
        if (!isChargeableCard(card)) {
          item.reason = `${decision.reason}:sin_tarjeta`;
          continue;
        }
        if (debtCents < AUTOCHARGE_MIN_CENTS) continue;
        await chargeDebt({
          profile,
          hecomClienteId: profile.hecom_cliente_id,
          memberId: card.whop_member_id,
          paymentMethodId: card.whop_payment_method_id,
          debtCents,
          now,
          reason: decision.reason,
        });
      }
    } catch (error) {
      item.error = error instanceof Error ? error.message : "Error desconocido";
    }
  }
  return { mode, items };
}
