import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import {
  APPEAL_MAX_FILES,
  APPEAL_MAX_FILE_BYTES,
  APPEAL_MIME_TYPES,
  fallbackAppealMessage,
  type AppealAttachment,
  type AppealDraftInput,
  type AppealRecord,
  type AppealStatus,
} from "@/lib/appeals/account-appeals.shared";

/**
 * Apelaciones de cuentas TikTok suspendidas. TikTok no tiene API para apelar: el
 * cliente deja datos y documentos, la IA arma el mensaje en inglés y gerencia lo
 * envía desde TikTok Business Support (Account Review → Account Suspension Appeal).
 */
const BUCKET = "appeal-docs";

export type SuspensionInfo = {
  status: string | null;
  reason: string | null;
  until: string | null;
  company: string | null;
};

/** Lo que TikTok dice de la cuenta (advertiser/info): motivo y hasta cuándo. */
export async function getTikTokSuspension(advertiserId: string): Promise<SuspensionInfo> {
  const empty: SuspensionInfo = { status: null, reason: null, until: null, company: null };
  const { token } = await resolveTikTokFinanceAccessToken();
  if (!token?.trim()) return empty;
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(
      `${base}/advertiser/info/?advertiser_ids=${encodeURIComponent(JSON.stringify([advertiserId]))}`,
      { headers: { "Access-Token": token.trim() }, cache: "no-store" },
    );
    const json = (await res.json()) as {
      data?: { list?: Array<Record<string, unknown>> };
    };
    const row = json.data?.list?.[0];
    if (!row) return empty;
    // «1:<motivo>,endtime:2036-10-05 17:33:27;2:<motivo>,endtime:…»
    const raw = String(row.rejection_reason ?? "");
    const first = raw.split(";")[0] ?? "";
    const reason = first.replace(/^\d+:/, "").replace(/,endtime:.*$/, "").trim() || null;
    const end = first.match(/endtime:([\d-]+ [\d:]+)/)?.[1];
    return {
      status: row.status ? String(row.status) : null,
      reason,
      until: end ? new Date(`${end.replace(" ", "T")}Z`).toISOString() : null,
      company: row.company ? String(row.company) : null,
    };
  } catch {
    return empty;
  }
}

/** La cuenta tiene que ser del cliente seleccionado (por su ficha Hecom). */
export async function resolveClienteAdAccount(input: {
  hecomClienteId: string;
  adAccountId: string;
}): Promise<{ adAccountId: string; organizationId: string | null; advertiserId: string; name: string; bmLabel: string | null }> {
  const { data: acc } = await createAdminClient()
    .from("ad_accounts")
    .select("id,organization_id,name,external_account_id")
    .eq("id", input.adAccountId)
    .maybeSingle();
  const advertiserId = String(acc?.external_account_id ?? "").trim();
  if (!acc || !advertiserId) throw new Error("Cuenta no encontrada.");
  const overview = await getHecomClienteAdAccountsOverview(input.hecomClienteId, "fast");
  const match = overview.accounts.find((a) => (a.externalAccountId ?? "").trim() === advertiserId);
  if (!match) throw new Error("Esa cuenta no es del cliente seleccionado.");
  const bucket = String(match.externalBusinessId ?? "").trim();
  const bm = /^\d{1,4}$/.test(bucket) ? `BM ${bucket}` : "";
  return {
    adAccountId: String(acc.id),
    organizationId: acc.organization_id ? String(acc.organization_id) : null,
    advertiserId,
    name: String(match.name ?? acc.name ?? advertiserId),
    bmLabel: bm || null,
  };
}

/** Datos para abrir el formulario: motivo de TikTok y lo que ya sabemos del cliente. */
export async function getAppealPrefill(input: { hecomClienteId: string; adAccountId: string }) {
  const account = await resolveClienteAdAccount(input);
  const [suspension, cliente] = await Promise.all([
    getTikTokSuspension(account.advertiserId),
    getHecomCliente(input.hecomClienteId).catch(() => null),
  ]);
  return {
    account,
    suspension,
    companyName: suspension.company ?? cliente?.biz ?? cliente?.name ?? "",
    taxId: cliente?.dni ?? "",
    contactEmail: cliente?.emails?.[0] ?? "",
    contactPhone: cliente?.phones?.[0] ?? "",
  };
}

/** Mensaje de apelación en inglés hecho con IA; sin IA, una plantilla con los mismos datos. */
export async function draftAppealMessage(input: AppealDraftInput): Promise<{ message: string; ai: boolean }> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) return { message: fallbackAppealMessage(input), ai: false };
  const facts = [
    `Ad account ID: ${input.advertiserId}`,
    `Ad account name: ${input.accountName}`,
    `Advertiser company: ${input.companyName}`,
    input.taxId ? `Tax ID (RUC/document): ${input.taxId}` : null,
    input.storeUrl ? `Store / landing URL: ${input.storeUrl}` : null,
    input.products ? `What they sell (client's words, may be Spanish): ${input.products}` : null,
    input.suspensionReason ? `Reason TikTok gave: ${input.suspensionReason}` : null,
    input.notes ? `Extra context from the client (may be Spanish): ${input.notes}` : null,
    `Attachments the agency will include: ${input.attachmentNames.length ? input.attachmentNames.join(", ") : "company registration, store URL, sample orders"}`,
  ].filter(Boolean);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: serverEnv.openAiVisionModel,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You write TikTok Ads account suspension appeals for Holistic Marketing, an advertising agency in Peru that manages ad accounts in its own Business Center for its clients. Write in clear, polite, professional English, 120-200 words, first person plural as the agency. Structure: who we are and which account; that we believe the suspension is a mistake; what the business sells and that it is real (registered company, real products, delivery, contact and return info); that we reviewed the ads and will remove anything that breaks policy; a concrete request to review and reinstate; list of attached documents. Use only the facts given, never invent numbers, dates, licenses or guarantees. Translate the client's Spanish into natural English. No subject line, no placeholders, no markdown. Sign as: Holistic Marketing team.",
          },
          { role: "user", content: facts.join("\n") },
        ],
      }),
    });
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!res.ok || !text) return { message: fallbackAppealMessage(input), ai: false };
    return { message: text, ai: true };
  } catch {
    return { message: fallbackAppealMessage(input), ai: false };
  }
}

function mapAppeal(row: Record<string, unknown>): AppealRecord {
  return {
    id: String(row.id),
    hecomClienteId: String(row.hecom_cliente_id),
    hecomClienteName: row.hecom_cliente_name ? String(row.hecom_cliente_name) : null,
    adAccountId: row.ad_account_id ? String(row.ad_account_id) : null,
    advertiserId: String(row.advertiser_id),
    advertiserName: row.advertiser_name ? String(row.advertiser_name) : null,
    bmLabel: row.bm_label ? String(row.bm_label) : null,
    suspensionReason: row.suspension_reason ? String(row.suspension_reason) : null,
    suspensionUntil: row.suspension_until ? String(row.suspension_until) : null,
    companyName: String(row.company_name ?? ""),
    taxId: row.tax_id ? String(row.tax_id) : null,
    storeUrl: row.store_url ? String(row.store_url) : null,
    products: row.products ? String(row.products) : null,
    contactEmail: row.contact_email ? String(row.contact_email) : null,
    contactPhone: row.contact_phone ? String(row.contact_phone) : null,
    clientNotes: row.client_notes ? String(row.client_notes) : null,
    appealMessage: String(row.appeal_message ?? ""),
    attachments: (Array.isArray(row.attachments) ? row.attachments : []) as AppealAttachment[],
    status: String(row.status) as AppealStatus,
    staffNotes: row.staff_notes ? String(row.staff_notes) : null,
    createdAt: String(row.created_at),
    sentAt: row.sent_at ? String(row.sent_at) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  };
}

/** Última apelación por cuenta del cliente (para el estado en la tabla de Pagos). */
export async function listAppealsForCliente(hecomClienteId: string): Promise<AppealRecord[]> {
  const { data, error } = await createAdminClient()
    .from("tiktok_account_appeals")
    .select("*")
    .eq("hecom_cliente_id", hecomClienteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const latest: AppealRecord[] = [];
  for (const row of data ?? []) {
    const a = mapAppeal(row as Record<string, unknown>);
    if (seen.has(a.advertiserId)) continue;
    seen.add(a.advertiserId);
    latest.push(a);
  }
  return latest;
}

export async function createAppeal(input: {
  hecomClienteId: string;
  hecomClienteName: string | null;
  adAccountId: string;
  userId: string;
  companyName: string;
  taxId: string;
  storeUrl: string;
  products: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  appealMessage: string;
  files: File[];
}): Promise<AppealRecord> {
  const account = await resolveClienteAdAccount({
    hecomClienteId: input.hecomClienteId,
    adAccountId: input.adAccountId,
  });
  if (!input.companyName.trim()) throw new Error("Falta el nombre de la empresa.");
  if (input.appealMessage.trim().length < 40) throw new Error("El mensaje de apelación está vacío.");
  if (input.files.length > APPEAL_MAX_FILES) throw new Error(`Máximo ${APPEAL_MAX_FILES} archivos.`);
  for (const f of input.files) {
    if (!APPEAL_MIME_TYPES.includes(f.type)) throw new Error(`«${f.name}»: solo fotos (JPG, PNG, WEBP) o PDF.`);
    if (f.size > APPEAL_MAX_FILE_BYTES) throw new Error(`«${f.name}» pesa más de 8 MB.`);
  }

  const admin = createAdminClient();
  const { data: open } = await admin
    .from("tiktok_account_appeals")
    .select("id")
    .eq("advertiser_id", account.advertiserId)
    .in("status", ["pending", "sent"])
    .maybeSingle();
  if (open) throw new Error("Esta cuenta ya tiene una apelación en revisión.");

  const suspension = await getTikTokSuspension(account.advertiserId);
  const folder = `${input.hecomClienteId}/${account.advertiserId}/${Date.now()}`;
  const attachments: AppealAttachment[] = [];
  for (const [i, f] of input.files.entries()) {
    const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80) || `archivo-${i + 1}`;
    const path = `${folder}/${i + 1}-${safe}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
    if (error) throw new Error(`No se pudo subir «${f.name}»: ${error.message}`);
    attachments.push({ path, name: f.name, mimeType: f.type, size: f.size });
  }

  const { data, error } = await admin
    .from("tiktok_account_appeals")
    .insert({
      organization_id: account.organizationId,
      hecom_cliente_id: input.hecomClienteId,
      hecom_cliente_name: input.hecomClienteName,
      ad_account_id: account.adAccountId,
      advertiser_id: account.advertiserId,
      advertiser_name: account.name,
      bm_label: account.bmLabel,
      suspension_reason: suspension.reason,
      suspension_until: suspension.until,
      company_name: input.companyName.trim(),
      tax_id: input.taxId.trim() || null,
      store_url: input.storeUrl.trim() || null,
      products: input.products.trim() || null,
      contact_email: input.contactEmail.trim() || null,
      contact_phone: input.contactPhone.trim() || null,
      client_notes: input.notes.trim() || null,
      appeal_message: input.appealMessage.trim(),
      attachments,
      created_by: input.userId,
    })
    .select("*")
    .single();
  if (error || !data) {
    await admin.storage.from(BUCKET).remove(attachments.map((a) => a.path));
    throw new Error(error?.message ?? "No se pudo guardar la apelación.");
  }
  return mapAppeal(data as Record<string, unknown>);
}

/** Bandeja de gerencia: todas, con enlaces firmados (1 h) para ver los documentos. */
export async function listAppealsForStaff(): Promise<Array<AppealRecord & { attachmentUrls: Record<string, string> }>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tiktok_account_appeals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => mapAppeal(r as Record<string, unknown>));
  const paths = rows.flatMap((r) => r.attachments.map((a) => a.path));
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }
  return rows.map((r) => ({
    ...r,
    attachmentUrls: Object.fromEntries(r.attachments.filter((a) => urls[a.path]).map((a) => [a.path, urls[a.path]!])),
  }));
}

export async function updateAppealStatus(input: {
  id: string;
  status: AppealStatus;
  staffNotes?: string | null;
  userId: string;
}): Promise<AppealRecord> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.staffNotes !== undefined) patch.staff_notes = input.staffNotes?.trim() || null;
  if (input.status === "sent") {
    patch.sent_at = now;
    patch.sent_by = input.userId;
  }
  if (input.status === "approved" || input.status === "rejected") patch.resolved_at = now;
  const { data, error } = await createAdminClient()
    .from("tiktok_account_appeals")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Apelación no encontrada.");
  return mapAppeal(data as Record<string, unknown>);
}
