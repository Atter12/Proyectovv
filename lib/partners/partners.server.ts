import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PARTNER_SLUG_RE, type Partner } from "./partners.shared";

const PARTNER_SELECT =
  "id,slug,name,headline,subheadline,logo_url,photo_url,accent_color,whatsapp,commission_rate,commission_months,status";

type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  subheadline: string | null;
  logo_url: string | null;
  photo_url: string | null;
  accent_color: string;
  whatsapp: string | null;
  commission_rate: number | string;
  commission_months: number;
  status: "active" | "paused";
};

function toPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    headline: row.headline,
    subheadline: row.subheadline,
    logoUrl: row.logo_url,
    photoUrl: row.photo_url,
    accentColor: row.accent_color,
    whatsapp: row.whatsapp,
    commissionRate: Number(row.commission_rate),
    commissionMonths: row.commission_months,
    status: row.status,
  };
}

export function normalizePartnerSlug(raw: string | null | undefined): string | null {
  const slug = String(raw ?? "").trim().toLowerCase();
  return PARTNER_SLUG_RE.test(slug) ? slug : null;
}

/** Aliado activo por slug (para la landing pública y la atribución). */
export async function getActivePartnerBySlug(rawSlug: string | null | undefined): Promise<Partner | null> {
  const slug = normalizePartnerSlug(rawSlug);
  if (!slug) return null;
  const { data, error } = await createAdminClient()
    .from("partners")
    .select(PARTNER_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<PartnerRow>();
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
  expires.setMonth(expires.getMonth() + partner.commissionMonths);
  // Un cliente es de un solo aliado: si ya tenía, se respeta el primero.
  const { error: clientError } = await admin.from("partner_clients").insert({
    partner_id: partner.id,
    hecom_cliente_id: input.hecomClienteId,
    email,
    source: "landing",
    attributed_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });
  if (clientError && clientError.code !== "23505") {
    console.warn("[partners] partner_client_insert_failed", { error: clientError.message });
  }
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
