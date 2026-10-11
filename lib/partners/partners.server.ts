import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomInt } from "crypto";
import { normalizeInviteCode, PARTNER_INVITE_RE, PARTNER_SLUG_RE, type Partner } from "./partners.shared";
import { applyPartnerClientFee } from "./partner-client-fee.server";
import { notifyPartnerEvent } from "./partner-notify.server";

const PARTNER_BASE_SELECT =
  "id,slug,name,company_name,headline,subheadline,logo_url,photo_url,accent_color,whatsapp,commission_rate,commission_days,status,theme";
const PARTNER_BRANDING_SELECT = `${PARTNER_BASE_SELECT},secondary_color,background_color,text_color,logo_size,favicon_url,banner_url,banner_mobile_url,banner_link`;
const PARTNER_SELECT = `${PARTNER_BRANDING_SELECT},client_fee_percent`;
/** De la más completa a la básica: si falta una migración (060, 059), se usa la siguiente. */
const PARTNER_SELECTS = [PARTNER_SELECT, PARTNER_BRANDING_SELECT, PARTNER_BASE_SELECT];

type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  company_name?: string | null;
  headline: string | null;
  subheadline: string | null;
  logo_url: string | null;
  photo_url: string | null;
  accent_color: string;
  whatsapp: string | null;
  commission_rate: number | string;
  commission_days: number;
  status: "active" | "paused";
  theme?: string | null;
  secondary_color?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  logo_size?: number | null;
  favicon_url?: string | null;
  banner_url?: string | null;
  banner_mobile_url?: string | null;
  banner_link?: string | null;
  client_fee_percent?: number | string | null;
};

function toPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    companyName: row.company_name ?? null,
    headline: row.headline,
    subheadline: row.subheadline,
    logoUrl: row.logo_url,
    photoUrl: row.photo_url,
    accentColor: row.accent_color,
    whatsapp: row.whatsapp,
    commissionRate: Number(row.commission_rate),
    commissionDays: row.commission_days,
    status: row.status,
    theme: row.theme === "dark" ? "dark" : "light",
    secondaryColor: row.secondary_color ?? null,
    backgroundColor: row.background_color ?? null,
    textColor: row.text_color ?? null,
    logoSize: row.logo_size ?? null,
    faviconUrl: row.favicon_url ?? null,
    bannerUrl: row.banner_url ?? null,
    bannerMobileUrl: row.banner_mobile_url ?? null,
    bannerLink: row.banner_link ?? null,
    clientFeePercent: row.client_fee_percent == null ? null : Number(row.client_fee_percent),
  };
}

/**
 * Aliado del cliente Hecom con contrato de alianza firmado y activo.
 * Es la única llave para que un cliente vea «Alianzas» en Ads Holistic.
 * Si la columna aún no existe (migración 054 sin aplicar) responde null.
 */
export async function getSignedPartnerForCliente(
  hecomClienteId: string | null | undefined,
): Promise<(Partner & { contractSignedAt: string }) | null> {
  const id = String(hecomClienteId ?? "").trim().toLowerCase();
  if (!id) return null;
  const read = (cols: string) =>
    createAdminClient()
      .from("partners")
      .select(`${cols},contract_signed_at`)
      .eq("hecom_cliente_id", id)
      .eq("status", "active")
      .not("contract_signed_at", "is", null)
      .maybeSingle<PartnerRow & { contract_signed_at: string }>();
  let { data, error } = await read(PARTNER_SELECTS[0]!);
  // Migraciones 060 / 059 sin aplicar: sigue con lo que haya.
  for (const cols of PARTNER_SELECTS.slice(1)) {
    if (error?.code !== "42703") break;
    ({ data, error } = await read(cols));
  }
  if (error) {
    console.warn("[partners] signed_partner_failed", { error: error.message });
    return null;
  }
  return data ? { ...toPartner(data), contractSignedAt: data.contract_signed_at } : null;
}

export function normalizePartnerSlug(raw: string | null | undefined): string | null {
  const slug = String(raw ?? "").trim().toLowerCase();
  return PARTNER_SLUG_RE.test(slug) ? slug : null;
}

/** Aliado activo por slug (para la landing pública y la atribución). */
export async function getActivePartnerBySlug(rawSlug: string | null | undefined): Promise<Partner | null> {
  const slug = normalizePartnerSlug(rawSlug);
  if (!slug) return null;
  const read = (cols: string) =>
    createAdminClient().from("partners").select(cols).eq("slug", slug).eq("status", "active").maybeSingle<PartnerRow>();
  let { data, error } = await read(PARTNER_SELECTS[0]!);
  // Migraciones 060 / 059 / 054 sin aplicar: la landing sigue funcionando con lo que haya.
  for (const cols of PARTNER_SELECTS.slice(1)) {
    if (error?.code !== "42703") break;
    ({ data, error } = await read(cols));
  }
  if (error?.code === "42703") ({ data, error } = await read(PARTNER_BASE_SELECT.replace(",theme", "").replace(",company_name", "")));
  if (error) {
    console.warn("[partners] get_by_slug_failed", { slug, error: error.message });
    return null;
  }
  return data ? toPartner(data) : null;
}

export async function recordPartnerVisit(input: {
  partnerId: string;
  visitorId: string | null;
  path: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  country: string | null;
  device: "mobile" | "desktop";
}): Promise<void> {
  const clip = (v: string | null, n = 300) => (v ? v.slice(0, n) : null);
  const { error } = await createAdminClient().from("partner_visits").insert({
    partner_id: input.partnerId,
    visitor_id: clip(input.visitorId, 64),
    path: clip(input.path),
    referrer: clip(input.referrer),
    utm_source: clip(input.utmSource, 120),
    utm_medium: clip(input.utmMedium, 120),
    utm_campaign: clip(input.utmCampaign, 120),
    country: clip(input.country, 8),
    device: input.device,
  });
  if (error) console.warn("[partners] visit_insert_failed", { error: error.message });
}

/**
 * Guarda qué trajo a un registro nuevo (aliado y/o código de referido) en el
 * momento en que se crea el cliente Hecom. El usuario aún no existe: se crea
 * al verificar el OTP, por eso esto va por email.
 * Si vino de un aliado activo, el cliente queda asignado a ese aliado.
 */
export async function recordSignupAttribution(input: {
  email: string;
  hecomClienteId: string;
  partnerSlug: string | null;
  referralCode: string | null;
  visitorId: string | null;
  /** Código de invitación de un solo uso que escribió el cliente. */
  inviteCode?: string | null;
}): Promise<void> {
  const partner = await getActivePartnerBySlug(input.partnerSlug);
  const referralCode = input.referralCode && /^[a-zA-Z0-9_-]{2,64}$/.test(input.referralCode) ? input.referralCode : null;
  if (!partner && !referralCode) return;

  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const { error } = await admin.from("signup_attributions").insert({
    email,
    hecom_cliente_id: input.hecomClienteId,
    partner_id: partner?.id ?? null,
    referral_code: referralCode,
    visitor_id: input.visitorId ? input.visitorId.slice(0, 64) : null,
  });
  if (error) console.warn("[partners] attribution_insert_failed", { error: error.message });

  if (!partner) return;
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + partner.commissionDays);

  // El código se gasta aquí (una sola vez). Si otro lo usó primero, igual queda pendiente.
  let inviteCode: string | null = null;
  const typedInvite = normalizeInviteCode(input.inviteCode);
  if (PARTNER_INVITE_RE.test(typedInvite)) {
    const { data: claimed } = await admin
      .from("partner_invite_codes")
      .update({ used_at: now.toISOString(), used_email: email, used_hecom_cliente_id: input.hecomClienteId })
      .eq("code", typedInvite)
      .eq("partner_id", partner.id)
      .is("used_at", null)
      .is("revoked_at", null)
      .select("code");
    inviteCode = claimed?.[0]?.code ?? null;
  }

  // Un cliente es de un solo aliado: si ya tenía, se respeta el primero.
  // Queda pendiente: cuenta (y paga el fee del aliado) recién cuando el aliado confirma que es suyo.
  const { error: clientError } = await admin.from("partner_clients").insert({
    partner_id: partner.id,
    hecom_cliente_id: input.hecomClienteId,
    email,
    source: "landing",
    status: "pending",
    invite_code: inviteCode,
    attributed_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });
  if (clientError && clientError.code !== "23505") {
    console.warn("[partners] partner_client_insert_failed", { error: clientError.message });
  }
  if (!clientError) {
    await notifyPartnerEvent({ kind: "signup", partnerId: partner.id, clienteEmail: email, hecomClienteId: input.hecomClienteId });
  }
}

/**
 * El aliado confirma que un registro pendiente es suyo: pasa a contar desde hoy
 * y se le pone el fee del aliado. Si dice que no, deja de estar a su nombre.
 */
export async function reviewPartnerClient(input: {
  partner: Pick<Partner, "id" | "commissionDays" | "clientFeePercent">;
  hecomClienteId: string;
  approve: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const id = String(input.hecomClienteId ?? "").trim();
  if (!input.approve) {
    const { error } = await admin
      .from("partner_clients")
      .delete()
      .eq("partner_id", input.partner.id)
      .eq("hecom_cliente_id", id)
      .eq("status", "pending");
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + input.partner.commissionDays);
  const { data, error } = await admin
    .from("partner_clients")
    .update({ status: "approved", reviewed_at: now.toISOString(), attributed_at: now.toISOString(), expires_at: expires.toISOString() })
    .eq("partner_id", input.partner.id)
    .eq("hecom_cliente_id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Ese registro ya no está pendiente." };
  const applied = await applyPartnerClientFee({ hecomClienteIds: [id], feePercent: input.partner.clientFeePercent });
  if (!applied) return { ok: false, error: "Quedó confirmado, pero no se pudo poner su fee. Avísale a Holistic." };
  return { ok: true };
}

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_OPEN_INVITES = 50;

/** Crea un código de invitación de un solo uso (JA-7K2PQ) para una persona. */
export async function createPartnerInvite(input: {
  partner: Pick<Partner, "id" | "slug">;
  note: string | null;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("partner_invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", input.partner.id)
    .is("used_at", null)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_OPEN_INVITES) {
    return { ok: false, error: `Tienes ${MAX_OPEN_INVITES} códigos sin usar. Anula alguno antes de crear otro.` };
  }
  const prefix =
    input.partner.slug
      .split("-")
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "AH";
  for (let attempt = 0; attempt < 5; attempt++) {
    let tail = "";
    for (let i = 0; i < 5; i++) tail += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
    const code = `${prefix}-${tail}`;
    const { error } = await admin
      .from("partner_invite_codes")
      .insert({ partner_id: input.partner.id, code, note: input.note });
    if (!error) return { ok: true, code };
    if (error.code !== "23505") return { ok: false, error: error.message };
  }
  return { ok: false, error: "No se pudo crear el código. Vuelve a intentar." };
}

/** Anula un código que todavía no se usó. */
export async function revokePartnerInvite(partnerId: string, inviteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await createAdminClient()
    .from("partner_invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("partner_id", partnerId)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return data?.length ? { ok: true } : { ok: false, error: "Ese código ya se usó o ya estaba anulado." };
}

export type SignupCode =
  | { kind: "partner"; slug: string; label: string; inviteCode: string }
  | { kind: "referral"; code: string };

/**
 * Código que el cliente escribe al registrarse: primero un código de invitación
 * de un solo uso de un aliado (sin usar ni anular); si no, un código de
 * referido activo. Null = no existe, ya se usó o está inactivo.
 */
export async function resolveSignupCode(raw: string | null | undefined): Promise<SignupCode | null> {
  const typed = String(raw ?? "").trim();
  if (!typed || typed.length > 64) return null;

  const invite = normalizeInviteCode(typed);
  if (PARTNER_INVITE_RE.test(invite)) {
    const { data } = await createAdminClient()
      .from("partner_invite_codes")
      .select("code,partner_id")
      .eq("code", invite)
      .is("used_at", null)
      .is("revoked_at", null)
      .maybeSingle<{ code: string; partner_id: string }>();
    if (data) {
      const { data: p } = await createAdminClient()
        .from("partners")
        .select("slug,name,company_name")
        .eq("id", data.partner_id)
        .eq("status", "active")
        .maybeSingle<{ slug: string; name: string; company_name: string | null }>();
      if (p) return { kind: "partner", slug: p.slug, label: p.company_name || p.name, inviteCode: data.code };
    }
  }

  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(typed)) return null;
  const { data, error } = await createAdminClient()
    .from("referral_codes")
    .select("code")
    .ilike("code", typed.replace(/_/g, "\\_"))
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ code: string }>();
  if (error) console.warn("[partners] referral_code_lookup_failed", { error: error.message });
  return data ? { kind: "referral", code: data.code } : null;
}

/** Código de referido guardado al registrarse (para el programa de referidos). */
export async function referralCodeForEmail(email: string | null | undefined): Promise<string | null> {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const { data } = await createAdminClient()
    .from("signup_attributions")
    .select("referral_code")
    .eq("email", normalized)
    .not("referral_code", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ referral_code: string | null }>();
  return data?.referral_code ?? null;
}
