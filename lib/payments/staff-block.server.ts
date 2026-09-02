import "server-only";
import { isRecord } from "@/lib/records";

/** Clientes Hecom bloqueados por staff — no recargar ni reactivar en sync. */
const STAFF_BLOCKED_HECOM_CLIENTE_IDS = new Set([
  "db572ee9-e816-4ac3-88fc-8db3c969f447", // Kevin Hernandez
]);

/** Advertisers TikTok bloqueados (BM10 Kevin). */
const STAFF_BLOCKED_ADVERTISER_IDS = new Set([
  "7675788689846353927",
  "7675788433108860946",
  "7675789143745675282",
  "7675788301218185234",
]);

export function isStaffBlockedHecomCliente(clienteId: string | null | undefined): boolean {
  const id = clienteId?.trim();
  return Boolean(id && STAFF_BLOCKED_HECOM_CLIENTE_IDS.has(id));
}

export function isStaffBlockedAdvertiserId(
  advertiserId: string | null | undefined,
): boolean {
  const id = advertiserId?.trim();
  return Boolean(id && STAFF_BLOCKED_ADVERTISER_IDS.has(id));
}

export function isStaffBlockedMetadata(metadata: unknown): boolean {
  if (!isRecord(metadata)) return false;
  return metadata.staff_blocked === true;
}

export function isStaffBlockedAdAccount(input: {
  status?: string | null;
  metadata?: unknown;
  externalAccountId?: string | null;
  hecomClienteId?: string | null;
}): boolean {
  if (input.status === "disabled" && isStaffBlockedMetadata(input.metadata)) {
    return true;
  }
  if (isStaffBlockedAdvertiserId(input.externalAccountId)) return true;
  if (isStaffBlockedHecomCliente(input.hecomClienteId)) return true;
  if (isStaffBlockedMetadata(input.metadata)) return true;
  if (isRecord(input.metadata)) {
    const clienteId = String(input.metadata.hecom_cliente_id ?? "").trim();
    if (isStaffBlockedHecomCliente(clienteId)) return true;
  }
  return false;
}

export function mergeStaffBlockMetadata(
  existing: unknown,
  input?: { reason?: string; blockedBy?: string },
): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {};
  base.staff_blocked = true;
  base.staff_blocked_at = base.staff_blocked_at ?? new Date().toISOString();
  if (input?.reason) base.staff_blocked_reason = input.reason;
  if (input?.blockedBy) base.staff_blocked_by = input.blockedBy;
  return base;
}

export function staffBlockStatusForUpsert(input: {
  existingMetadata?: unknown;
  externalAccountId?: string | null;
  hecomClienteId?: string | null;
  tiktokStatusKind?: "approved" | "suspended" | "unknown";
}): { blocked: boolean; status: "active" | "disabled" } {
  const blocked = isStaffBlockedAdAccount({
    metadata: input.existingMetadata,
    externalAccountId: input.externalAccountId,
    hecomClienteId: input.hecomClienteId,
  });

  if (blocked) {
    return { blocked: true, status: "disabled" };
  }

  if (input.tiktokStatusKind === "suspended") {
    return { blocked: false, status: "disabled" };
  }

  return { blocked: false, status: "active" };
}
