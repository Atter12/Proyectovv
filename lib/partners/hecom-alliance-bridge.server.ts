import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPartnersWithStats, type PartnerWithStats } from "./partners-admin.server";
import { PARTNER_SLUG_RE, partnerLandingPath } from "./partners.shared";
import { notifyPartnerEvent } from "./partner-notify.server";

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
  commissionDays: number;
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
  commissionDays?: number | null;
  /** Contrato de alianza firmado: amarra el aliado al cliente y le abre la sección Alianzas. */
  hecomClienteId?: string | null;
  contractSignedAt?: string | null;
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
    commissionDays: p.commissionDays,
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
  const signed = signedLink(input);
  if (signed && "error" in signed) return { ok: false, error: signed.error, status: 400 };
  const existing = await getAlliancePartner(input.allianceId);
  if (existing) {
    // La duración sale del contrato (formulario de la alianza en Hecom).
    if (input.commissionDays != null && Number(input.commissionDays) !== existing.commissionDays) {
      const synced = await setCommissionDays(existing.id, Number(input.commissionDays));
      if (!synced.ok) return synced;
    }
    // El % también sale del acuerdo en Hecom.
    if (input.commissionPercent != null && Number(input.commissionPercent) !== existing.commissionPercent) {
      const synced = await setCommissionPercent(existing.id, Number(input.commissionPercent));
      if (!synced.ok) return synced;
    }
    if (signed) {
      const linked = await linkSignedCliente(existing.id, signed);
      if (!linked.ok) return linked;
    }
    const fresh = await getAlliancePartner(input.allianceId);
    return { ok: true, partner: fresh ?? existing, created: false };
  }

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
  const days = input.commissionDays == null ? 50 : Math.round(Number(input.commissionDays));
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return { ok: false, error: "Los días de comisión deben estar entre 1 y 3650.", status: 400 };
  }

  const slug = requested || (await freeSlug(slugFromName(name)));
  const whatsapp = String(input.whatsapp ?? "").replace(/[^\d+]/g, "").slice(0, 20) || null;
  const { error } = await createAdminClient().from("partners").insert({
    slug,
    name: name.replace(/^alianza\s+(con\s+)?/i, "").trim() || name,
    whatsapp,
    commission_rate: Math.round(percent * 100) / 10000,
    commission_days: days,
    hecom_alliance_id: input.allianceId.toLowerCase(),
    ...(signed ? { hecom_cliente_id: signed.hecomClienteId, contract_signed_at: signed.contractSignedAt } : {}),
    notes: signed
      ? "Creado al firmar el contrato de alianza en Hecom."
      : "Creado desde la ficha de la alianza en Hecom.",
  });
  if (!error && signed) {
    const made = await getAlliancePartner(input.allianceId);
    if (made) await notifyPartnerEvent({ kind: "signed", partnerId: made.id });
  }
  if (error) {
    if (error.code === "23505") {
      // Otra pestaña la creó al mismo tiempo, o el link pedido ya existe.
      const again = await getAlliancePartner(input.allianceId);
      if (again) return { ok: true, partner: again, created: false };
      if (signed && /hecom_cliente/.test(error.message)) {
        return { ok: false, error: "Ese cliente ya es aliado con otra alianza.", status: 409 };
      }
      return { ok: false, error: "Ese link ya lo usa otro aliado.", status: 409 };
    }
    return { ok: false, error: error.message, status: 500 };
  }
  const partner = await getAlliancePartner(input.allianceId);
  if (!partner) return { ok: false, error: "El aliado se creó pero no se pudo leer.", status: 500 };
  return { ok: true, partner, created: true };
}

type SignedLink = { hecomClienteId: string; contractSignedAt: string };

function signedLink(input: CreateAlliancePartnerInput): SignedLink | { error: string } | null {
  const clienteId = String(input.hecomClienteId ?? "").trim().toLowerCase();
  if (!clienteId) return null;
  if (!UUID_RE.test(clienteId)) return { error: "Cliente Hecom inválido." };
  const at = input.contractSignedAt ? Date.parse(input.contractSignedAt) : NaN;
  return {
    hecomClienteId: clienteId,
    contractSignedAt: new Date(Number.isFinite(at) ? at : Date.now()).toISOString(),
  };
}

/** Aliado ya creado: le pone el cliente y la fecha de firma (y lo reactiva). */
async function linkSignedCliente(
  partnerId: string,
  signed: SignedLink,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: before } = await createAdminClient()
    .from("partners")
    .select("contract_signed_at")
    .eq("id", partnerId)
    .maybeSingle<{ contract_signed_at: string | null }>();
  const { error } = await createAdminClient()
    .from("partners")
    .update({
      hecom_cliente_id: signed.hecomClienteId,
      contract_signed_at: signed.contractSignedAt,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);
  if (!error) {
    if (!before?.contract_signed_at) await notifyPartnerEvent({ kind: "signed", partnerId });
    return { ok: true };
  }
  if (error.code === "23505") return { ok: false, error: "Ese cliente ya es aliado con otra alianza.", status: 409 };
  return { ok: false, error: error.message, status: 500 };
}

/** Cambia la duración de la comisión y recalcula hasta cuándo genera cada cliente ya atribuido. */
async function setCommissionDays(
  partnerId: string,
  days: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const n = Math.round(days);
  if (!Number.isFinite(n) || n < 1 || n > 3650) {
    return { ok: false, error: "Los días de comisión deben estar entre 1 y 3650.", status: 400 };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("partners")
    .update({ commission_days: n, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  if (error) return { ok: false, error: error.message, status: 500 };
  const { data: clients } = await admin.from("partner_clients").select("id,attributed_at").eq("partner_id", partnerId);
  for (const c of clients ?? []) {
    const expires = new Date(c.attributed_at);
    expires.setDate(expires.getDate() + n);
    await admin.from("partner_clients").update({ expires_at: expires.toISOString() }).eq("id", c.id);
  }
  return { ok: true };
}

/** Cambia el % del fee que gana el aliado. Solo afecta las comisiones que se generen desde ahora. */
async function setCommissionPercent(
  partnerId: string,
  percent: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
    return { ok: false, error: "La comisión debe estar entre 0% y 50% del fee.", status: 400 };
  }
  const { error } = await createAdminClient()
    .from("partners")
    .update({ commission_rate: Math.round(percent * 100) / 10000, updated_at: new Date().toISOString() })
    .eq("id", partnerId);
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true };
}

export const PAYOUT_METHODS =["Yape", "Plin", "BCP", "Interbank", "Transferencia", "Efectivo", "Otro"] as const;

/**
 * Liquida la comisión de un aliado desde Hecom: marca como pagadas todas sus
 * comisiones pendientes, deja el medio y la referencia, y le avisa.
 */
export async function payAlliancePartner(input: {
  allianceId: string;
  method: string;
  reference?: string | null;
  paidBy?: string | null;
}): Promise<{ ok: true; paidCents: number; count: number } | { ok: false; error: string; status: number }> {
  const partnerId = await partnerIdForAlliance(input.allianceId);
  if (!partnerId) return { ok: false, error: "Esta alianza no tiene aliado en Ads Holistic.", status: 404 };
  const method = (PAYOUT_METHODS as readonly string[]).includes(input.method) ? input.method : null;
  if (!method) return { ok: false, error: "Elige el medio de pago.", status: 400 };
  const reference = String(input.reference ?? "").trim().slice(0, 120) || null;
  const admin = createAdminClient();
  const { data: pending, error: readError } = await admin
    .from("partner_commissions")
    .select("id,commission_cents")
    .eq("partner_id", partnerId)
    .eq("status", "pending");
  if (readError) return { ok: false, error: readError.message, status: 500 };
  if (!pending?.length) return { ok: false, error: "No hay comisión pendiente por pagar.", status: 409 };
  const ids = pending.map((c) => c.id as string);
  const paidCents = pending.reduce((s, c) => s + Number(c.commission_cents), 0);
  const note = [method, reference, input.paidBy ? `por ${input.paidBy}` : null].filter(Boolean).join(" · ").slice(0, 300);
  const { error } = await admin
    .from("partner_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString(), payout_note: note })
    .in("id", ids)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message, status: 500 };
  await notifyPartnerEvent({ kind: "payout", partnerId, paidCents, method, reference });
  return { ok: true, paidCents, count: ids.length };
}
