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
};

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

export async function isDuplicateOperationCode(
  operationCode: string,
  excludeIntentId: string,
): Promise<boolean> {
  const normalized = normalizeOperationCode(operationCode);
  if (!normalized) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id, status")
    .eq("provider", "manual")
    .contains("metadata", { voucher_operation_code: normalized })
    .in("status", ["succeeded", "processing"])
    .limit(10);

  if (error) {
    console.error("[voucher-security] operation code duplicate check failed", error.message);
    return false;
  }

  return (data ?? []).some((row) => row.id !== excludeIntentId);
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
      reason: `Demasiados comprobantes en la última hora (${uploadsLastHour}). Esperá unos minutos e intentá de nuevo.`,
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
