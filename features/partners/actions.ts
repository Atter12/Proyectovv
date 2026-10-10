"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { requireSession } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { applyPartnerClientFee } from "@/lib/partners/partner-client-fee.server";
import { PARTNER_SLUG_RE } from "@/lib/partners/partners.shared";

export type PartnerActionResult = { ok: true } | { ok: false; error: string };

export type PartnerInput = {
  id?: string | null;
  slug: string;
  name: string;
  headline: string;
  subheadline: string;
  logoUrl: string;
  photoUrl: string;
  accentColor: string;
  whatsapp: string;
  commissionPercent: number;
  commissionDays: number;
  /** Fee preferencial de sus clientes; vacío = cada cliente con su fee normal. */
  clientFeePercent: number | null;
  notes: string;
};

async function assertStaff(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const caps = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if (!caps.isStaff && !caps.isSuperAdmin) return { ok: false, error: "Solo gerentes pueden gestionar alianzas." };
  return { ok: true, userId: session.id };
}

const clean = (v: string, max = 300) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};
const isHttpUrl = (v: string | null) => !v || /^https:\/\/\S+$/i.test(v);

export async function savePartnerAction(input: PartnerInput): Promise<PartnerActionResult> {
  const staff = await assertStaff();
  if (!staff.ok) return staff;

  const slug = String(input.slug ?? "").trim().toLowerCase();
  if (!PARTNER_SLUG_RE.test(slug)) {
    return { ok: false, error: "El link debe tener 2–40 letras minúsculas, números o guiones (ej. mentor-juan)." };
  }
  const name = clean(input.name, 80);
  if (!name) return { ok: false, error: "Pon el nombre del aliado." };
  const logoUrl = clean(input.logoUrl, 500);
  const photoUrl = clean(input.photoUrl, 500);
  if (!isHttpUrl(logoUrl) || !isHttpUrl(photoUrl)) {
    return { ok: false, error: "Logo y foto deben ser links https://." };
  }
  const accent = /^#[0-9a-fA-F]{6}$/.test(input.accentColor) ? input.accentColor : "#ff781f";
  const percent = Number(input.commissionPercent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
    return { ok: false, error: "La comisión debe estar entre 0% y 50% del fee." };
  }
  const days = Math.round(Number(input.commissionDays));
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return { ok: false, error: "Los días de comisión deben estar entre 1 y 3650." };
  }

  const clientFee =
    input.clientFeePercent == null || String(input.clientFeePercent) === "" ? null : Number(input.clientFeePercent);
  if (clientFee != null && (!Number.isFinite(clientFee) || clientFee < 0 || clientFee > 50)) {
    return { ok: false, error: "El fee de sus clientes debe estar entre 0% y 50%." };
  }

  const row = {
    slug,
    name,
    headline: clean(input.headline, 120),
    subheadline: clean(input.subheadline, 300),
    logo_url: logoUrl,
    photo_url: photoUrl,
    accent_color: accent,
    whatsapp: clean(String(input.whatsapp ?? "").replace(/[^\d+]/g, ""), 20),
    commission_rate: Math.round(percent * 100) / 10000,
    commission_days: days,
    client_fee_percent: clientFee == null ? null : Math.round(clientFee * 100) / 100,
    notes: clean(input.notes, 1000),
    updated_at: new Date().toISOString(),
  };
  const admin = createAdminClient();
  const { error } = input.id
    ? await admin.from("partners").update(row).eq("id", input.id)
    : await admin.from("partners").insert({ ...row, created_by: staff.userId });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Ese link ya lo usa otro aliado." : error.message };
  }
  // Fee preferencial: también para los clientes que el aliado ya tiene.
  if (input.id && clientFee != null) {
    const { data: clients } = await admin.from("partner_clients").select("hecom_cliente_id").eq("partner_id", input.id);
    const applied = await applyPartnerClientFee({
      hecomClienteIds: (clients ?? []).map((c) => String(c.hecom_cliente_id)),
      feePercent: clientFee,
    });
    if (!applied) {
      return { ok: false, error: "Se guardó el aliado, pero no se pudo poner el fee a sus clientes en Hecom. Vuelve a guardar." };
    }
  }
  revalidatePath(routes.alianzas);
  return { ok: true };
}

export async function setPartnerStatusAction(id: string, status: "active" | "paused"): Promise<PartnerActionResult> {
  const staff = await assertStaff();
  if (!staff.ok) return staff;
  const { error } = await createAdminClient()
    .from("partners")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(routes.alianzas);
  return { ok: true };
}

/**
 * Asigna a mano un cliente que ya existía (por su correo) a un aliado. Para los
 * clientes que el aliado trajo antes de tener landing. No pisa otro aliado.
 */
export async function assignClientToPartnerAction(partnerId: string, email: string): Promise<PartnerActionResult> {
  const staff = await assertStaff();
  if (!staff.ok) return staff;
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, error: "Escribe el correo del cliente." };

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("id,commission_days,client_fee_percent")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return { ok: false, error: "Aliado no encontrado." };

  const { data: matches, error: findError } = await createHecomAdminClient()
    .from("clientes")
    .select("id,name")
    .contains("emails", [normalized])
    .limit(2);
  if (findError) return { ok: false, error: findError.message };
  if (!matches?.length) return { ok: false, error: "No hay ningún cliente con ese correo en Hecom." };
  if (matches.length > 1) return { ok: false, error: "Hay más de un cliente con ese correo: asígnalo desde soporte." };

  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + Number(partner.commission_days));
  const { error } = await admin.from("partner_clients").insert({
    partner_id: partnerId,
    hecom_cliente_id: String(matches[0]!.id),
    email: normalized,
    source: "manual",
    attributed_at: now.toISOString(),
    expires_at: expires.toISOString(),
    created_by: staff.userId,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Ese cliente ya pertenece a un aliado." : error.message };
  }
  const applied = await applyPartnerClientFee({
    hecomClienteIds: [String(matches[0]!.id)],
    feePercent: partner.client_fee_percent == null ? null : Number(partner.client_fee_percent),
  });
  if (!applied) return { ok: false, error: "Cliente asignado, pero no se pudo poner su fee en Hecom. Revísalo en su ficha." };
  revalidatePath(routes.alianzas);
  return { ok: true };
}

/** Marca como pagadas todas las comisiones pendientes del aliado (liquidación). */
export async function markPartnerCommissionsPaidAction(partnerId: string, note: string): Promise<PartnerActionResult> {
  const staff = await assertStaff();
  if (!staff.ok) return staff;
  const { error } = await createAdminClient()
    .from("partner_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString(), payout_note: clean(note, 300) })
    .eq("partner_id", partnerId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath(routes.alianzas);
  return { ok: true };
}
