import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { verifyLoPagadoToken } from "@/lib/hecom/lo-pagado-public-token";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { createPaymentIntentForSession } from "@/lib/payments/create-intent.server";
import { createMissingCobroClaim } from "@/lib/payments/create-missing-cobro-claim.server";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import {
  processManualVoucherUpload,
  VoucherRateLimitError,
} from "@/lib/payments/process-manual-voucher.server";
import { isMissingCobroPurpose } from "@/lib/payments/missing-cobro.shared";
import { isGatewayInMaintenance } from "@/lib/payments/gateway-config";
import { isVoucherPaymentProvider } from "@/types/payment";
import { mergeMetadata } from "@/lib/records";
import type { SessionUser } from "@/types/auth";

export const PUBLIC_LO_PAGADO_ENTRY = "lo_pagado_link";

const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type PublicLoPagadoContext = {
  clientId: string;
  clienteName: string;
  organizationId: string | null;
};

export type PublicLoPagadoActivity = {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  reviewStatus: string;
  kind: "manual" | "missing_cobro";
  periodoResumen: string | null;
};

export class PublicLoPagadoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function resolvePublicLoPagado(
  token: string,
): Promise<PublicLoPagadoContext | null> {
  const raw = String(token || "").trim();
  if (!raw || raw.length > 400) return null;
  const clientId = verifyLoPagadoToken(raw, serverEnv.holisticWaSnapshotSecret);
  if (!clientId) return null;
  const cliente = await getHecomCliente(clientId);
  if (!cliente?.id) return null;
  const organizationId = await resolveOrganizationIdForHecomCliente(cliente.id);
  return {
    clientId: cliente.id,
    clienteName: cliente.name,
    organizationId,
  };
}

function requireOrganization(ctx: PublicLoPagadoContext): string {
  if (!ctx.organizationId) {
    throw new PublicLoPagadoError(
      "Esta cuenta aún no está lista para pagos. Escríbenos por el mismo WhatsApp.",
    );
  }
  return ctx.organizationId;
}

function publicSession(ctx: PublicLoPagadoContext): SessionUser {
  return {
    id: "",
    email: "",
    name: ctx.clienteName,
    role: "viewer",
    permissions: [],
    organizationId: ctx.organizationId,
  } as unknown as SessionUser;
}

async function countRecentPublicManuals(clientId: string): Promise<number> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("payment_intents")
    .select("id", { count: "exact", head: true })
    .eq("provider", "manual")
    .gte("created_at", since)
    .filter("metadata->>hecom_cliente_id", "eq", clientId)
    .filter("metadata->>public_entry", "eq", PUBLIC_LO_PAGADO_ENTRY);
  if (error) return 0;
  return count ?? 0;
}

export async function createPublicManualIntent(input: {
  ctx: PublicLoPagadoContext;
  amount: number;
  chargeCurrency?: "USD" | "PEN";
}): Promise<{ paymentIntentId: string }> {
  if (isGatewayInMaintenance("manual")) {
    throw new PublicLoPagadoError(
      "El pago manual está deshabilitado temporalmente. Escríbenos por WhatsApp.",
      503,
    );
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 10 || amount > 50_000) {
    throw new PublicLoPagadoError("El monto debe estar entre $10 y $50,000.");
  }
  const organizationId = requireOrganization(input.ctx);
  const recent = await countRecentPublicManuals(input.ctx.clientId);
  if (recent >= 6) {
    throw new PublicLoPagadoError(
      "Ya hay varios pagos abiertos. Espera a que gerencia revise uno antes de crear otro.",
      429,
    );
  }

  const result = await createPaymentIntentForSession(publicSession(input.ctx), {
    amount,
    currency: "USD",
    chargeCurrency: input.chargeCurrency === "PEN" ? "PEN" : "USD",
    provider: "manual",
    hecomClienteId: input.ctx.clientId,
    organizationId,
    actorUserId: null,
    metadataExtra: { public_entry: PUBLIC_LO_PAGADO_ENTRY },
  });

  return { paymentIntentId: result.paymentIntentId };
}

export async function createPublicMissingCobro(input: {
  ctx: PublicLoPagadoContext;
  amountUsd: number;
  periodoResumen: string;
  paymentFecha: string;
  metodo?: string;
  operationCode?: string;
  notes?: string;
  amountPen?: number | null;
}): Promise<{ paymentIntentId: string }> {
  const organizationId = requireOrganization(input.ctx);
  const result = await createMissingCobroClaim({
    hecomClienteId: input.ctx.clientId,
    hecomClienteName: input.ctx.clienteName,
    organizationId,
    amountUsd: input.amountUsd,
    periodoResumen: input.periodoResumen,
    paymentFecha: input.paymentFecha,
    metodo: input.metodo,
    operationCode: input.operationCode,
    notes: input.notes,
    amountPen: input.amountPen,
  });
  await mergePublicEntry(result.paymentIntentId);
  return { paymentIntentId: result.paymentIntentId };
}

async function mergePublicEntry(paymentIntentId: string): Promise<void> {
  const intent = await getPaymentIntentByIdInternal(paymentIntentId);
  if (!intent) return;
  await updatePaymentIntentRecord(paymentIntentId, {
    metadata: mergeMetadata(intent.metadata ?? {}, {
      public_entry: PUBLIC_LO_PAGADO_ENTRY,
    }),
  });
}

function intentOwnedByClient(
  metadata: Record<string, unknown> | null | undefined,
  clientId: string,
): boolean {
  const meta = metadata ?? {};
  const owner = String(meta.hecom_cliente_id ?? "")
    .trim()
    .toLowerCase();
  if (!owner || owner !== clientId.trim().toLowerCase()) return false;
  const purpose = String(meta.purpose ?? "");
  if (
    purpose === "realprofit_cod" ||
    purpose === "staff_fund_from_bm" ||
    purpose === "transfer_existing_tiktok_balance"
  ) {
    return false;
  }
  const source = String(meta.source ?? "");
  if (
    source === "agency_bm_bridge" ||
    source === "tiktok_balance_import" ||
    source === "profit_subscribe"
  ) {
    return false;
  }
  if (isMissingCobroPurpose(meta)) return true;
  if (String(meta.public_entry ?? "") === PUBLIC_LO_PAGADO_ENTRY) return true;
  return source === "dashboard" || source === "manual" || source === "manual_voucher";
}

function sanitizeFileName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return clean || "voucher";
}

export async function uploadPublicLoPagadoProof(input: {
  ctx: PublicLoPagadoContext;
  intentId: string;
  proof: File;
  payMethod: "bank" | "binance" | null;
}): Promise<{
  autoApproved: boolean;
  creditUsdCents: number;
  status: string;
}> {
  const organizationId = requireOrganization(input.ctx);
  const intent = await getPaymentIntentByIdInternal(input.intentId);
  if (
    !intent ||
    !intentOwnedByClient(
      (intent.metadata ?? {}) as Record<string, unknown>,
      input.ctx.clientId,
    )
  ) {
    throw new PublicLoPagadoError("No encontramos ese pago en esta cuenta.", 404);
  }
  if (intent.organizationId && intent.organizationId !== organizationId) {
    throw new PublicLoPagadoError("No encontramos ese pago en esta cuenta.", 404);
  }
  if (!isVoucherPaymentProvider(intent.provider)) {
    throw new PublicLoPagadoError("Este pago no acepta comprobante.");
  }
  if (["succeeded", "cancelled"].includes(intent.status)) {
    throw new PublicLoPagadoError("Este pago ya no acepta comprobantes.", 409);
  }
  if (intent.provider === "manual" && isGatewayInMaintenance("manual")) {
    throw new PublicLoPagadoError(
      "El pago manual está deshabilitado temporalmente.",
      503,
    );
  }

  const proof = input.proof;
  if (proof.size <= 0) {
    throw new PublicLoPagadoError("El archivo está vacío.");
  }
  if (proof.size > MAX_PROOF_SIZE_BYTES) {
    throw new PublicLoPagadoError("El comprobante no puede superar 10 MB.");
  }
  if (proof.type && !ALLOWED_MIME_TYPES.has(proof.type)) {
    throw new PublicLoPagadoError("Usa JPG, PNG, WEBP o PDF.");
  }

  const admin = createAdminClient();
  const safeName = sanitizeFileName(proof.name);
  const storagePath = `${organizationId}/${intent.id}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(storagePath, proof, {
      contentType: proof.type || "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    throw new PublicLoPagadoError(
      "No se pudo subir el comprobante. Intenta de nuevo.",
      500,
    );
  }

  if (input.payMethod) {
    await updatePaymentIntentRecord(intent.id, {
      metadata: mergeMetadata(intent.metadata ?? {}, {
        manual_pay_method: input.payMethod,
      }),
    });
  }

  const buffer = Buffer.from(await proof.arrayBuffer());
  try {
    const processed = await processManualVoucherUpload({
      paymentIntentId: intent.id,
      organizationId,
      buffer,
      mimeType: proof.type || "application/octet-stream",
      fileName: safeName,
      storagePath,
      submittedBy: `lo-pagado:${input.ctx.clientId}`,
    });
    return {
      autoApproved: processed.autoApproved,
      creditUsdCents: processed.creditUsdCents,
      status: processed.status,
    };
  } catch (error) {
    if (error instanceof VoucherRateLimitError) {
      throw new PublicLoPagadoError(error.message, 429);
    }
    throw new PublicLoPagadoError(
      "Recibimos el archivo, pero no pudimos procesarlo. Escríbenos por WhatsApp.",
      500,
    );
  }
}

function reviewStatusOf(row: {
  status: string;
  metadata: Record<string, unknown> | null;
}): string {
  const review = String(row.metadata?.manual_review_status ?? "");
  if (review === "pending_review" || review === "approved" || review === "rejected") {
    return review;
  }
  if (row.status === "succeeded") return "approved";
  if (row.status === "failed" || row.status === "cancelled") return "rejected";
  if (row.status === "processing") return "pending_review";
  return "awaiting_proof";
}

export async function listPublicLoPagadoActivity(
  clientId: string,
): Promise<PublicLoPagadoActivity[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id, amount_cents, currency, status, metadata, created_at, provider")
    .eq("provider", "manual")
    .filter("metadata->>hecom_cliente_id", "eq", clientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.flatMap((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (!intentOwnedByClient(meta, clientId)) return [];
    const missing = isMissingCobroPurpose(meta);
    const cents = Number(row.amount_cents) || 0;
    const periodo =
      typeof meta.periodo_resumen === "string" ? meta.periodo_resumen : null;
    return [
      {
        id: String(row.id),
        createdAt: String(row.created_at),
        amount: cents / 100,
        currency: String(row.currency || "USD"),
        reviewStatus: reviewStatusOf({
          status: String(row.status),
          metadata: meta,
        }),
        kind: missing ? "missing_cobro" : "manual",
        periodoResumen: periodo,
      },
    ];
  });
}
