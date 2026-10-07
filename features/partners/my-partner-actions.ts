"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { requireSession } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getSignedPartnerForCliente } from "@/lib/partners/partners.server";
import {
  PARTNER_ACCENT_RE,
  PARTNER_DEFAULT_ACCENT,
  partnerLandingPath,
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
};

export type MyPartnerResult = { ok: true; url?: string | null } | { ok: false; error: string };

const BUCKET = "partner-assets";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

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

  const { error } = await createAdminClient()
    .from("partners")
    .update({
      name,
      company_name: clip(input.companyName, 80),
      headline: clip(input.headline, 120),
      subheadline: clip(input.subheadline, 240),
      accent_color: accent,
      theme: input.theme === "dark" ? "dark" : "light",
      whatsapp: whatsapp || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", mine.partner.id);
  if (error) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  refresh(mine.partner.slug);
  return { ok: true };
}

/** Sube (o quita, sin archivo) el logo o la foto. Se guardan en un bucket público. */
export async function uploadMyPartnerImageAction(formData: FormData): Promise<MyPartnerResult> {
  const mine = await myPartner();
  if (!mine.ok) return mine;
  const kind = formData.get("kind") === "photo" ? "photo" : "logo";
  const column = kind === "photo" ? "photo_url" : "logo_url";
  const admin = createAdminClient();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    const { error } = await admin.from("partners").update({ [column]: null, updated_at: new Date().toISOString() }).eq("id", mine.partner.id);
    if (error) return { ok: false, error: "No se pudo quitar la imagen." };
    refresh(mine.partner.slug);
    return { ok: true, url: null };
  }

  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { ok: false, error: "Sube una imagen PNG, JPG o WEBP." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "La imagen pesa más de 2 MB." };

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
