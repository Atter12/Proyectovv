import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";

export type VoucherRateLimitResult = {
  uploadAllowed: boolean;
  autoApproveAllowed: boolean;
  uploadsLastHour: number;
  autoApprovesLast10Min: number;
  reason: string | null;
};

export type VoucherSecurityFlags = {
  duplicateContentHash: boolean;
  duplicateOperationCode: boolean;
  rateLimitBlocksAutoApprove: boolean;
  uploadRateLimited: boolean;
  /**
   * La consulta de duplicados falló. No sabemos si el comprobante es repetido,
   * así que se trata igual que uno repetido: nunca se acredita solo.
   */
  duplicateCheckFailed?: boolean;
};

/**
 * Resultado de buscar duplicados. `checkFailed` separa "no hay duplicado" de
 * "no pudimos mirar": antes un error de base se leía como "limpio" y dejaba
 * pasar a acreditación automática un comprobante que nadie verificó.
 */
export type DuplicateCheckResult = {
  duplicate: boolean;
  checkFailed: boolean;
};

/**
 * Estados donde un comprobante ya "está tomado". No basta con `succeeded`: la
 * misma captura subida a dos pagos abiertos a la vez pasaba el filtro en los
 * dos, porque ninguno estaba acreditado todavía.
 */
const VOUCHER_CLAIMING_STATUSES = [
  "succeeded",
  "processing",
  "requires_payment",
  "created",
] as const;

const MIN_OPERATION_CODE_LENGTH = 4;

/** Normaliza código de operación bancario para comparación (Yape/Plin/BCP). */
export function normalizeOperationCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw
    .trim()
    .toUpperCase()
    .replace(/[\s.\-_/]+/g, "");
  if (normalized.length < MIN_OPERATION_CODE_LENGTH) return null;
  return normalized;
}

function readIsoTimestamp(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readManualProofSubmittedAt(metadata: Record<string, unknown> | null): string | null {
  const proof = metadata?.manual_proof;
  if (!proof || typeof proof !== "object") return null;
  const submittedAt = (proof as Record<string, unknown>).submitted_at;
  return typeof submittedAt === "string" ? submittedAt : null;
}

function isWithinWindow(isoTimestamp: string, windowMs: number): boolean {
  const ts = Date.parse(isoTimestamp);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= windowMs;
}

/** ¿Otra intención manual ya tiene este mismo archivo de comprobante? */
export async function checkDuplicateVoucherHash(
  hash: string,
  excludeIntentId: string,
): Promise<DuplicateCheckResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id")
    .eq("provider", "manual")
    .in("status", [...VOUCHER_CLAIMING_STATUSES])
    .contains("metadata", { voucher_content_hash: hash })
    .neq("id", excludeIntentId)
    .limit(1);

  if (error) {
    console.error("[voucher-security] voucher hash duplicate check failed", error.message);
    return { duplicate: false, checkFailed: true };
  }

  return { duplicate: Boolean(data?.length), checkFailed: false };
}

export async function checkDuplicateOperationCode(
  operationCode: string,
  excludeIntentId: string,
): Promise<DuplicateCheckResult> {
  const normalized = normalizeOperationCode(operationCode);
  if (!normalized) return { duplicate: false, checkFailed: false };

  const admin = createAdminClient();

  const [byOcr, byClaim] = await Promise.all([
    admin
      .from("payment_intents")
      .select("id")
      .eq("provider", "manual")
      .contains("metadata", { voucher_operation_code: normalized })
      .in("status", [...VOUCHER_CLAIMING_STATUSES])
      .neq("id", excludeIntentId)
      .limit(1),
    admin
      .from("payment_intents")
      .select("id")
      .eq("provider", "manual")
      .contains("metadata", { claimed_operation_code: normalized })
      .in("status", [...VOUCHER_CLAIMING_STATUSES])
      .neq("id", excludeIntentId)
      .limit(1),
  ]);

  if (byOcr.error) {
    console.error(
      "[voucher-security] operation code duplicate check failed",
      byOcr.error.message,
    );
  }
  if (byClaim.error) {
    console.error(
      "[voucher-security] claimed operation code duplicate check failed",
      byClaim.error.message,
    );
  }

  const duplicate = Boolean(byOcr.data?.length || byClaim.data?.length);
  // Si una de las dos consultas encontró el código, es duplicado aunque la
  // otra haya fallado. Si no encontró nada pero alguna falló, no sabemos.
  return {
    duplicate,
    checkFailed: !duplicate && Boolean(byOcr.error || byClaim.error),
  };
}

/** Intento abierto que ya guardó este código (para retomar un voucher a medias). */
export async function findOperationCodeIntent(
  operationCode: string,
): Promise<{
  id: string;
  status: string;
  amountCents: number;
  metadata: Record<string, unknown>;
} | null> {
  const normalized = normalizeOperationCode(operationCode);
  if (!normalized) return null;

  const admin = createAdminClient();
  const statuses = ["succeeded", "processing", "requires_payment", "created"] as const;
  const select = "id,status,amount_cents,metadata";

  const [byOcr, byClaim] = await Promise.all([
    admin
      .from("payment_intents")
      .select(select)
      .eq("provider", "manual")
      .contains("metadata", { voucher_operation_code: normalized })
      .in("status", [...statuses])
      .limit(1),
    admin
      .from("payment_intents")
      .select(select)
      .eq("provider", "manual")
      .contains("metadata", { claimed_operation_code: normalized })
      .in("status", [...statuses])
      .limit(1),
  ]);

  const row = byOcr.data?.[0] ?? byClaim.data?.[0];
  if (!row?.id) return null;
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    status: String(row.status ?? ""),
    amountCents: Number(row.amount_cents ?? 0) || 0,
    metadata,
  };
}

export async function checkVoucherUploadRateLimits(
  organizationId: string,
): Promise<VoucherRateLimitResult> {
  const maxUploadsPerHour = serverEnv.manualVoucherMaxUploadsPerHour;
  const maxAutoApprovesPer10Min = serverEnv.manualVoucherMaxAutoApprovesPer10Min;
  const hardUploadCapPerHour = serverEnv.manualVoucherHardUploadCapPerHour;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tenMinAgoMs = 10 * 60 * 1000;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id, status, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("provider", "manual")
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[voucher-security] rate limit query failed", error.message);
    return {
      uploadAllowed: true,
      autoApproveAllowed: false,
      uploadsLastHour: 0,
      autoApprovesLast10Min: 0,
      reason: "No pudimos verificar límites; revisión manual requerida.",
    };
  }

  let uploadsLastHour = 0;
  let autoApprovesLast10Min = 0;

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const uploadedAt =
      readIsoTimestamp(meta, "voucher_analyzed_at") ??
      readManualProofSubmittedAt(meta);

    if (uploadedAt && isWithinWindow(uploadedAt, 60 * 60 * 1000)) {
      uploadsLastHour += 1;
    }

    if (row.status === "succeeded" && meta.auto_approved === true) {
      const approvedAt = readIsoTimestamp(meta, "approved_at");
      if (approvedAt && isWithinWindow(approvedAt, tenMinAgoMs)) {
        autoApprovesLast10Min += 1;
      }
    }
  }

  if (uploadsLastHour >= hardUploadCapPerHour) {
    return {
      uploadAllowed: false,
      autoApproveAllowed: false,
      uploadsLastHour,
      autoApprovesLast10Min,
      reason: `Se enviaron demasiados comprobantes durante la última hora (${uploadsLastHour}). Espera unos minutos e inténtalo de nuevo.`,
    };
  }

  const rateLimitBlocksAutoApprove =
    uploadsLastHour >= maxUploadsPerHour ||
    autoApprovesLast10Min >= maxAutoApprovesPer10Min;

  let reason: string | null = null;
  if (uploadsLastHour >= maxUploadsPerHour) {
    reason = `Límite de ${maxUploadsPerHour} comprobantes por hora alcanzado. Revisión manual requerida.`;
  } else if (autoApprovesLast10Min >= maxAutoApprovesPer10Min) {
    reason = `Demasiadas acreditaciones automáticas recientes. Revisión manual requerida.`;
  }

  return {
    uploadAllowed: true,
    autoApproveAllowed: !rateLimitBlocksAutoApprove,
    uploadsLastHour,
    autoApprovesLast10Min,
    reason,
  };
}

/**
 * ¿Este comprobante ya se acreditó en OTRA recarga? Solo cuenta recargas pagadas
 * (succeeded). Se usa al aprobar: Ximena Jaño, 09/10/2026, se aprobó la misma
 * imagen (op. 03259646) que ya se había acreditado el 22/09.
 */
export async function findApprovedDuplicateVoucher(input: {
  intentId: string;
  contentHash?: string | null;
  operationCode?: string | null;
}): Promise<{ intentId: string; by: "imagen" | "operacion" } | null> {
  const admin = createAdminClient();
  const hash = input.contentHash?.trim();
  if (hash) {
    const { data, error } = await admin
      .from("payment_intents")
      .select("id")
      .eq("status", "succeeded")
      .contains("metadata", { voucher_content_hash: hash })
      .neq("id", input.intentId)
      .limit(1);
    if (error) throw new Error("No se pudo revisar si el comprobante ya se usó. Intenta de nuevo.");
    if (data?.length) return { intentId: String(data[0]!.id), by: "imagen" };
  }
  const op = input.operationCode ? normalizeOperationCode(input.operationCode) : "";
  if (op) {
    for (const key of ["voucher_operation_code", "claimed_operation_code"]) {
      const { data, error } = await admin
        .from("payment_intents")
        .select("id")
        .eq("status", "succeeded")
        .contains("metadata", { [key]: op })
        .neq("id", input.intentId)
        .limit(1);
      if (error) throw new Error("No se pudo revisar si el comprobante ya se usó. Intenta de nuevo.");
      if (data?.length) return { intentId: String(data[0]!.id), by: "operacion" };
    }
  }
  return null;
}
