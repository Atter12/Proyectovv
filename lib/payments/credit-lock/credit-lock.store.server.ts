import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreditLockApprovalStatus =
  | "none"
  | "requested"
  | "approved"
  | "rejected";

export type CreditLockProfileRow = {
  organization_id: string;
  hecom_cliente_id: string | null;
  requested_credit_cents: number | null;
  card_headroom_percent: number;
  soft_cap_percent: number;
  require_card: boolean;
  notes: string | null;
  approval_status: CreditLockApprovalStatus;
  requested_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const PROFILE_SELECT =
  "organization_id,hecom_cliente_id,requested_credit_cents,card_headroom_percent,soft_cap_percent,require_card,notes,approval_status,requested_at,reviewed_at,reviewed_by";

function normalizeStatus(raw: unknown): CreditLockApprovalStatus {
  const s = String(raw ?? "none");
  if (
    s === "requested" ||
    s === "approved" ||
    s === "rejected" ||
    s === "none"
  ) {
    return s;
  }
  return "none";
}

function mapRow(
  data: Record<string, unknown> | null,
): CreditLockProfileRow | null {
  if (!data) return null;
  return {
    organization_id: String(data.organization_id),
    hecom_cliente_id: data.hecom_cliente_id
      ? String(data.hecom_cliente_id)
      : null,
    requested_credit_cents:
      data.requested_credit_cents != null
        ? Number(data.requested_credit_cents)
        : null,
    card_headroom_percent: Number(data.card_headroom_percent ?? 15),
    soft_cap_percent: Number(data.soft_cap_percent ?? 90),
    require_card: data.require_card !== false,
    notes: data.notes != null ? String(data.notes) : null,
    approval_status: normalizeStatus(data.approval_status),
    requested_at: data.requested_at ? String(data.requested_at) : null,
    reviewed_at: data.reviewed_at ? String(data.reviewed_at) : null,
    reviewed_by: data.reviewed_by ? String(data.reviewed_by) : null,
  };
}

export async function getCreditLockProfile(
  organizationId: string,
): Promise<CreditLockProfileRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credit_lock_profiles")
    .select(PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") return null;
    // Columna nueva aún no migrada en algún entorno.
    if (error.code === "42703" || /approval_status/i.test(error.message)) {
      const legacy = await admin
        .from("credit_lock_profiles")
        .select(
          "organization_id,hecom_cliente_id,requested_credit_cents,card_headroom_percent,soft_cap_percent,require_card,notes",
        )
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (legacy.error) {
        if (legacy.error.code === "42P01") return null;
        throw new Error(legacy.error.message);
      }
      if (!legacy.data) return null;
      // Sin columnas de aprobación: abuelo cupos ya cargados como aprobados.
      return mapRow({
        ...legacy.data,
        approval_status: legacy.data.requested_credit_cents
          ? "approved"
          : "none",
      });
    }
    throw new Error(error.message);
  }
  return mapRow(data as Record<string, unknown> | null);
}

export async function upsertCreditLockProfile(input: {
  organizationId: string;
  hecomClienteId?: string | null;
  requestedCreditCents: number;
  cardHeadroomPercent?: number;
  softCapPercent?: number;
  requireCard?: boolean;
  notes?: string | null;
  approvalStatus?: CreditLockApprovalStatus;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}): Promise<CreditLockProfileRow> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    organization_id: input.organizationId,
    hecom_cliente_id: input.hecomClienteId ?? null,
    requested_credit_cents: input.requestedCreditCents,
    card_headroom_percent: input.cardHeadroomPercent ?? 15,
    soft_cap_percent: input.softCapPercent ?? 90,
    require_card: input.requireCard ?? true,
    notes: input.notes ?? null,
    approval_status: input.approvalStatus ?? "requested",
    requested_at: input.requestedAt ?? now,
    reviewed_at: input.reviewedAt ?? null,
    reviewed_by: input.reviewedBy ?? null,
    updated_at: now,
  };

  const { data, error } = await admin
    .from("credit_lock_profiles")
    .upsert(payload, { onConflict: "organization_id" })
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    if (error.code === "42703" || /approval_status/i.test(error.message)) {
      const { data: legacy, error: e2 } = await admin
        .from("credit_lock_profiles")
        .upsert(
          {
            organization_id: input.organizationId,
            hecom_cliente_id: input.hecomClienteId ?? null,
            requested_credit_cents: input.requestedCreditCents,
            card_headroom_percent: input.cardHeadroomPercent ?? 15,
            soft_cap_percent: input.softCapPercent ?? 90,
            require_card: input.requireCard ?? true,
            notes: input.notes ?? null,
            updated_at: now,
          },
          { onConflict: "organization_id" },
        )
        .select(
          "organization_id,hecom_cliente_id,requested_credit_cents,card_headroom_percent,soft_cap_percent,require_card,notes",
        )
        .single();
      if (e2) throw new Error(e2.message);
      return mapRow({
        ...legacy,
        approval_status: input.approvalStatus ?? "requested",
      })!;
    }
    throw new Error(error.message);
  }
  return mapRow(data as Record<string, unknown>)!;
}

export async function setCreditLockApproval(input: {
  organizationId: string;
  status: "approved" | "rejected";
  reviewedBy: string;
  notes?: string | null;
}): Promise<CreditLockProfileRow> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("credit_lock_profiles")
    .update({
      approval_status: input.status,
      reviewed_at: now,
      reviewed_by: input.reviewedBy,
      ...(input.notes != null ? { notes: input.notes } : {}),
      updated_at: now,
    })
    .eq("organization_id", input.organizationId)
    .select(PROFILE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>)!;
}
