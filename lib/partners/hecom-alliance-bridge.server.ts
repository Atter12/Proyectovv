import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPartnersWithStats, type PartnerWithStats } from "./partners-admin.server";
import { PARTNER_SLUG_RE, partnerLandingPath } from "./partners.shared";

/**
 * Puente Hecom → Ads Holistic para alianzas. La alianza se registra en Hecom y,
 * desde su ficha, se crea aquí el aliado (landing, panel y comisión). Hecom
 * consulta después sus números para mostrarlos en la misma ficha.
 */

const PUBLIC_BASE = "https://www.adsholistic.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HecomAlliancePartner = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "paused";
  commissionPercent: number;
  commissionMonths: number;
  landingUrl: string;
  panelUrl: string | null;
  createdAt: string;
  stats: PartnerWithStats["stats"];
};

export type CreateAlliancePartnerInput = {
  allianceId: string;
  name: string;
  slug?: string | null;
  whatsapp?: string | null;
  commissionPercent?: number | null;
  commissionMonths?: number | null;
};

export function isAllianceId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function toBridgePartner(p: PartnerWithStats): HecomAlliancePartner {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    commissionPercent: Math.round(p.commissionRate * 10000) / 100,
    commissionMonths: p.commissionMonths,
    landingUrl: `${PUBLIC_BASE}${partnerLandingPath(p.slug)}`,
    panelUrl: p.panelUrl,
    createdAt: p.createdAt,
    stats: p.stats,
  };
}

/** «Alianza Jerson Artezano» → «jerson-artezano». */
export function slugFromName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^alianza\s+(con\s+)?/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34)
    .replace(/-+$/g, "");
  return PARTNER_SLUG_RE.test(base) ? base : "aliado";
}

async function partnerIdForAlliance(allianceId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("partners")
    .select("id")
    .eq("hecom_alliance_id", allianceId.toLowerCase())
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function getAlliancePartner(allianceId: string): Promise<HecomAlliancePartner | null> {
  const id = await partnerIdForAlliance(allianceId);
  if (!id) return null;
  const partner = (await listPartnersWithStats()).find((p) => p.id === id);
  return partner ? toBridgePartner(partner) : null;
}

async function freeSlug(wanted: string): Promise<string> {
  const admin = createAdminClient();
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? wanted : `${wanted.slice(0, 36)}-${i + 1}`;
    const { data } = await admin.from("partners").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("No se encontró un link libre para el aliado.");
}

/** Crea el aliado de una alianza. Si ya existe, devuelve el mismo (idempotente). */
export async function createAlliancePartner(
  input: CreateAlliancePartnerInput,
): Promise<{ ok: true; partner: HecomAlliancePartner; created: boolean } | { ok: false; error: string; status: number }> {
  const existing = await getAlliancePartner(input.allianceId);
  if (existing) return { ok: true, partner: existing, created: false };

  const name = String(input.name ?? "").trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "La alianza necesita un nombre.", status: 400 };

  const requested = String(input.slug ?? "").trim().toLowerCase();
  if (requested && !PARTNER_SLUG_RE.test(requested)) {
    return { ok: false, error: "El link debe tener 2–40 letras minúsculas, números o guiones.", status: 400 };
  }
  const percent = input.commissionPercent == null ? 20 : Number(input.commissionPercent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
    return { ok: false, error: "La comisión debe estar entre 0% y 50% del fee.", status: 400 };
  }
  const months = input.commissionMonths == null ? 12 : Math.round(Number(input.commissionMonths));
  if (!Number.isFinite(months) || months < 1 || months > 120) {
    return { ok: false, error: "Los meses de comisión deben estar entre 1 y 120.", status: 400 };
  }

  const slug = requested || (await freeSlug(slugFromName(name)));
  const whatsapp = String(input.whatsapp ?? "").replace(/[^\d+]/g, "").slice(0, 20) || null;
  const { error } = await createAdminClient().from("partners").insert({
    slug,
    name: name.replace(/^alianza\s+(con\s+)?/i, "").trim() || name,
    whatsapp,
    commission_rate: Math.round(percent * 100) / 10000,
    commission_months: months,
    hecom_alliance_id: input.allianceId.toLowerCase(),
    notes: "Creado desde la ficha de la alianza en Hecom.",
  });
  if (error) {
    if (error.code === "23505") {
      // Otra pestaña la creó al mismo tiempo, o el link pedido ya existe.
      const again = await getAlliancePartner(input.allianceId);
      if (again) return { ok: true, partner: again, created: false };
      return { ok: false, error: "Ese link ya lo usa otro aliado.", status: 409 };
    }
    return { ok: false, error: error.message, status: 500 };
  }
  const partner = await getAlliancePartner(input.allianceId);
  if (!partner) return { ok: false, error: "El aliado se creó pero no se pudo leer.", status: 500 };
  return { ok: true, partner, created: true };
}
