"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { requireSession } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getSignedPartnerForCliente } from "@/lib/partners/partners.server";
import {
  PARTNER_ACCENT_RE,
  PARTNER_DEFAULT_ACCENT,
  partnerInkOn,
  partnerLandingPath,
  partnerLogoSize,
  type Partner,
} from "@/lib/partners/partners.shared";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lo que el cliente aliado edita de su landing /a/<link>.
 * El link, la comisión y el estado los maneja Holistic; aquí no se tocan.
 */
export type MyPartnerInput = {
  name: string;
  companyName: string;
  headline: string;
  subheadline: string;
  accentColor: string;
  theme: "light" | "dark";
  whatsapp: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  logoSize: number;
  bannerLink: string;
};

/** Imágenes de la landing: cada una en su columna y con su peso máximo. */
const IMAGE_KINDS = {
  logo: { column: "logo_url", maxBytes: 2 * 1024 * 1024 },
  photo: { column: "photo_url", maxBytes: 2 * 1024 * 1024 },
  favicon: { column: "favicon_url", maxBytes: 512 * 1024 },
  banner: { column: "banner_url", maxBytes: 4 * 1024 * 1024 },
  banner_mobile: { column: "banner_mobile_url", maxBytes: 4 * 1024 * 1024 },
} as const;
export type MyPartnerImageKind = keyof typeof IMAGE_KINDS;

export type MyPartnerResult = { ok: true; url?: string | null } | { ok: false; error: string };

const BUCKET = "partner-assets";
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const ICON_TYPES: Record<string, string> = { "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico" };
const hexOrNull = (v: unknown) => (typeof v === "string" && PARTNER_ACCENT_RE.test(v) ? v.toLowerCase() : null);

/** El aliado del cliente elegido en la sesión, solo si firmó su contrato. */
async function myPartner(): Promise<{ ok: true; partner: Partner } | { ok: false; error: string }> {
  const session = await requireSession();
  const selected = await getSelectedHecomCliente(session.id);
  const partner = selected ? await getSignedPartnerForCliente(selected.id) : null;
  if (!partner) return { ok: false, error: "Tu alianza todavía no está activa." };
  return { ok: true, partner };
}

const clip = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

function refresh(slug: string) {
  revalidatePath(routes.alianzas);
  revalidatePath(partnerLandingPath(slug));
}

export async function saveMyPartnerAction(input: MyPartnerInput): Promise<MyPartnerResult> {
  const mine = await myPartner();
  if (!mine.ok) return mine;
  const name = clip(input.name, 80);
  if (!name || name.length < 2) return { ok: false, error: "Escribe tu nombre." };
  const whatsapp = String(input.whatsapp ?? "").replace(/[^\d]/g, "").slice(0, 15);
  if (whatsapp && whatsapp.length < 8) return { ok: false, error: "Revisa tu WhatsApp: número con código de país, ej. 51987654321." };
  const accent = PARTNER_ACCENT_RE.test(input.accentColor) ? input.accentColor.toLowerCase() : PARTNER_DEFAULT_ACCENT;
  const background = hexOrNull(input.backgroundColor);
  const text = hexOrNull(input.textColor);
  if (background && text && background === text) return { ok: false, error: "El fondo y el texto no pueden ser del mismo color." };
  const bannerLink = String(input.bannerLink ?? "").trim();
  if (bannerLink && (!/^https:\/\/[^\s]+$/.test(bannerLink) || bannerLink.length > 300)) {
    return { ok: false, error: "El link del banner debe empezar con https://" };
  }
  // El tema queda en sincronía con el fondo (para quien aún lee solo «theme»).
  const theme = background ? (partnerInkOn(background) === "#ffffff" ? "dark" : "light") : input.theme === "dark" ? "dark" : "light";

  const { error } = await createAdminClient()
    .from("partners")
    .update({
      name,
      company_name: clip(input.companyName, 80),
      headline: clip(input.headline, 120),
      subheadline: clip(input.subheadline, 240),
      accent_color: accent,
      theme,
      whatsapp: whatsapp || null,
      secondary_color: hexOrNull(input.secondaryColor),
      background_color: background,
      text_color: text,
      logo_size: partnerLogoSize(input.logoSize),
      banner_link: bannerLink || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", mine.partner.id);
  if (error) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  refresh(mine.partner.slug);
  return { ok: true };
}

/** Sube (o quita, sin archivo) logo, foto, favicon o banners. Se guardan en un bucket público. */
export async function uploadMyPartnerImageAction(formData: FormData): Promise<MyPartnerResult> {
  const mine = await myPartner();
  if (!mine.ok) return mine;
  const rawKind = String(formData.get("kind") ?? "");
  const kind: MyPartnerImageKind = rawKind in IMAGE_KINDS ? (rawKind as MyPartnerImageKind) : "logo";
  const { column, maxBytes } = IMAGE_KINDS[kind];
  const admin = createAdminClient();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    const { error } = await admin.from("partners").update({ [column]: null, updated_at: new Date().toISOString() }).eq("id", mine.partner.id);
    if (error) return { ok: false, error: "No se pudo quitar la imagen." };
    refresh(mine.partner.slug);
    return { ok: true, url: null };
  }

  const ext = IMAGE_TYPES[file.type] ?? (kind === "favicon" ? ICON_TYPES[file.type] : undefined);
  if (!ext) return { ok: false, error: kind === "favicon" ? "Sube el favicon en PNG o ICO." : "Sube una imagen PNG, JPG o WEBP." };
  if (file.size > maxBytes) {
    return { ok: false, error: `La imagen pesa más de ${maxBytes >= 1024 * 1024 ? `${maxBytes / (1024 * 1024)} MB` : `${maxBytes / 1024} KB`}.` };
  }

  const path = `${mine.partner.id}/${kind}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (uploaded.error) {
    console.warn("[partners] image_upload_failed", { error: uploaded.error.message });
    return { ok: false, error: "No se pudo subir la imagen." };
  }
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from("partners").update({ [column]: url, updated_at: new Date().toISOString() }).eq("id", mine.partner.id);
  if (error) return { ok: false, error: "La imagen se subió pero no se guardó." };
  refresh(mine.partner.slug);
  return { ok: true, url };
}
