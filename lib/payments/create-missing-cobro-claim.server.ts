import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payments/providers";
import { isGatewayInMaintenance } from "@/lib/payments/gateway-config";
import {
  createPaymentIntentRecord,
  mergePaymentIntentMetadata,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import type { SessionUser } from "@/types/auth";
import {
  MISSING_COBRO_MAX_PENDING,
  MISSING_COBRO_PURPOSE,
  MISSING_COBRO_SOURCE,
  normalizePeriodoResumen,
} from "@/lib/payments/missing-cobro.shared";
import {
  findOperationCodeIntent,
  normalizeOperationCode,
} from "@/lib/payments/voucher-security.server";

async function assertOrganizationExists(organizationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle<{ id: string }>();
  if (!data?.id) {
    throw new Error(
      "No encontramos la organización del cliente. Recarga la página o pide al equipo que revise el vínculo Hecom.",
    );
  }
}

async function resolveWalletId(organizationId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  if (data?.id) return data.id;

  const { data: anyWallet } = await admin
    .from("wallets")
    .select("id, status")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle<{ id: string; status: string }>();

  if (anyWallet?.id) {
    if (anyWallet.status !== "active") {
      const { error: reactivateErr } = await admin
        .from("wallets")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", anyWallet.id);
      if (reactivateErr) throw new Error(reactivateErr.message);
    }
    return anyWallet.id;
  }

  const { data: created, error: createErr } = await admin
    .from("wallets")
    .insert({
      organization_id: organizationId,
      name: "Cartera Default",
      balance_cents: 0,
      currency: "USD",
      status: "active",
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (createErr || !created?.id) {
    throw new Error(
      createErr?.message || "No se encontró cartera activa para la organización.",
    );
  }
  return created.id;
}

async function countPendingMissingClaims(
  hecomClienteId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id, status, metadata")
    .eq("provider", "manual")
    .in("status", ["requires_payment", "processing", "created"])
    .filter("metadata->>purpose", "eq", MISSING_COBRO_PURPOSE)
    .filter("metadata->>hecom_cliente_id", "eq", hecomClienteId)
    .limit(20);

  if (error) {
    console.error("[missing-cobro] pending count failed", error.message);
    return 0;
  }

  return (data ?? []).filter((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const review = String(meta.manual_review_status ?? "");
    return (
      review === "awaiting_proof" ||
      review === "pending_review" ||
      row.status === "requires_payment" ||
      row.status === "processing"
    );
  }).length;
}

function claimHasUploadedProof(metadata: Record<string, unknown>): boolean {
  const proof = metadata.manual_proof;
  if (!proof || typeof proof !== "object") return false;
  const path = (proof as Record<string, unknown>).path;
  return typeof path === "string" && path.length > 0;
}

async function resumeOwnOpenMissingClaim(
  existing: {
    id: string;
    status: string;
    amountCents: number;
    metadata: Record<string, unknown>;
  },
  input: {
    hecomClienteId: string;
    amountCents: number;
    periodo: string;
    fecha: string;
    metodo: string;
    notes: string | null;
    amountPen: number | null;
  },
): Promise<{
  paymentIntentId: string;
  status: string;
  amountCents: number;
  currency: string;
  periodoResumen: string;
} | null> {
  const meta = existing.metadata;
  const sameClient = String(meta.hecom_cliente_id ?? "") === input.hecomClienteId;
  const purpose = String(meta.purpose ?? "");
  const review = String(meta.manual_review_status ?? "");
  const stillOpen =
    sameClient &&
    purpose === MISSING_COBRO_PURPOSE &&
    !claimHasUploadedProof(meta) &&
    (existing.status === "requires_payment" || existing.status === "created") &&
    (review === "awaiting_proof" || review === "");
  if (!stillOpen) return null;

  if (existing.amountCents !== input.amountCents) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("payment_intents")
      .update({
        amount_cents: input.amountCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  }

  await mergePaymentIntentMetadata(existing.id, {
    periodo_resumen: input.periodo,
    claimed_payment_fecha: input.fecha,
    claimed_metodo: input.metodo,
    claimed_notes: input.notes,
    claimed_amount_pen: input.amountPen,
    gross_amount_cents: input.amountCents,
    gross_usd_cents: input.amountCents,
    manual_review_status: "awaiting_proof",
  });

  return {
    paymentIntentId: existing.id,
    status: "requires_payment",
    amountCents: input.amountCents,
    currency: "USD",
    periodoResumen: input.periodo,
  };
}

export type CreateMissingCobroClaimInput = {
  session: SessionUser;
  hecomClienteId: string;
  hecomClienteName?: string | null;
  organizationId: string;
  /** USD amount claimed (what should appear as cobro). */
  amountUsd: number;
  periodoResumen: string;
  paymentFecha: string;
  metodo?: string | null;
  operationCode?: string | null;
  notes?: string | null;
  amountPen?: number | null;
};

export async function createMissingCobroClaim(
  input: CreateMissingCobroClaimInput,
): Promise<{
  paymentIntentId: string;
  status: string;
  amountCents: number;
  currency: string;
  periodoResumen: string;
}> {
  if (isGatewayInMaintenance("manual")) {
    throw new Error(
      "El reporte de comprobantes está deshabilitado temporalmente. Contacta a soporte.",
    );
  }

  const periodo = normalizePeriodoResumen(input.periodoResumen);
  if (!periodo) {
    throw new Error("Período inválido. Usa el formato AAAA-MM (ej. 2026-09).");
  }

  const amountUsd = Number(input.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 50000) {
    throw new Error("Monto inválido. Indica el monto en USD del voucher (mín. $1).");
  }

  const fecha = String(input.paymentFecha ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error("Fecha de pago inválida.");
  }

  await assertOrganizationExists(input.organizationId);

  const pending = await countPendingMissingClaims(input.hecomClienteId);
  if (pending >= MISSING_COBRO_MAX_PENDING) {
    throw new Error(
      `Ya tienes ${MISSING_COBRO_MAX_PENDING} reportes abiertos. Espera a que gerencia revise uno antes de enviar otro.`,
    );
  }

  const provider = getPaymentProvider("manual");
  if (!provider.isConfigured()) {
    throw new Error("Pago manual no configurado.");
  }

  const walletId = await resolveWalletId(input.organizationId);
  const amountCents = Math.round(amountUsd * 100);
  const metodo = String(input.metodo ?? "Interbank").trim() || "Interbank";
  const opCodeRaw = String(input.operationCode ?? "").trim() || null;
  const opCode = opCodeRaw ? normalizeOperationCode(opCodeRaw) ?? opCodeRaw : null;
  const notes = String(input.notes ?? "").trim() || null;
  const amountPen =
    input.amountPen != null && Number.isFinite(input.amountPen) && input.amountPen > 0
      ? Number(input.amountPen)
      : null;

  if (opCode) {
    const existing = await findOperationCodeIntent(opCode);
    if (existing) {
      const resumed = await resumeOwnOpenMissingClaim(existing, {
        hecomClienteId: input.hecomClienteId,
        amountCents,
        periodo,
        fecha,
        metodo,
        notes,
        amountPen,
      });
      if (resumed) return resumed;
      const meta = existing.metadata;
      const sameClient =
        String(meta.hecom_cliente_id ?? "") === input.hecomClienteId;
      const review = String(meta.manual_review_status ?? "");
      if (
        sameClient &&
        (review === "pending_review" ||
          review === "approved" ||
          existing.status === "succeeded")
      ) {
        throw new Error(
          "Este voucher ya está en revisión o ya fue registrado. No hace falta enviarlo otra vez.",
        );
      }
      throw new Error(
        "Este código de operación ya fue usado en otro pago. Si crees que es un error, escribe a soporte.",
      );
    }
  }

  const idempotencyKey = `missing-cobro:${input.hecomClienteId}:${periodo}:${amountCents}:${fecha}:${opCode ?? randomUUID().slice(0, 8)}`;

  const intent = await createPaymentIntentRecord({
    organizationId: input.organizationId,
    walletId,
    amountCents,
    currency: "USD",
    provider: "manual",
    createdBy: input.session.id,
    idempotencyKey,
    metadata: {
      provider: "manual",
      source: MISSING_COBRO_SOURCE,
      purpose: MISSING_COBRO_PURPOSE,
      hecom_cliente_id: input.hecomClienteId,
      hecom_cliente_name: input.hecomClienteName ?? null,
      charge_currency: "USD",
      fee_percent: 0,
      fee_amount_cents: 0,
      credit_amount_cents: 0,
      gross_amount_cents: amountCents,
      gross_usd_cents: amountCents,
      wallet_credit_currency: "USD",
      skip_wallet_credit: true,
      periodo_resumen: periodo,
      claimed_payment_fecha: fecha,
      claimed_metodo: metodo,
      claimed_operation_code: opCode,
      ...(opCode ? { voucher_operation_code: opCode } : {}),
      claimed_notes: notes,
      claimed_amount_pen: amountPen,
      requires_manager_approval: true,
      product: "hecom_missing_cobro",
    },
  });

  await provider.createCheckout({
    amountCents,
    currency: "USD",
    organizationId: input.organizationId,
    walletId,
    paymentIntentId: intent.id,
    idempotencyKey: intent.idempotencyKey ?? randomUUID(),
    customerEmail: input.session.email,
    concept: input.hecomClienteName
      ? `Cobro faltante · ${input.hecomClienteName} · ${periodo}`
      : `Cobro faltante · ${periodo}`,
    metadata: {},
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "requires_payment",
  });
  await mergePaymentIntentMetadata(intent.id, {
    manual_review_status: "awaiting_proof",
  });

  return {
    paymentIntentId: intent.id,
    status: "requires_payment",
    amountCents,
    currency: "USD",
    periodoResumen: periodo,
  };
}
