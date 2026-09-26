"use server";

import { revalidatePath } from "next/cache";
import {
  ALLIANCE_FILES_BUCKET,
  formatAllianceDate,
  isAllianceId,
  isAllowedAllianceFile,
  parseActivityDraft,
  parseAgreementDraft,
  parseAllianceDraft,
  parseContactDraft,
  parseContractDraft,
  parseFileCategory,
  parseReminderDraft,
  safeStorageFileName,
  todayInLima,
  ALLIANCE_TYPE_LABEL,
  type ActivityDraft,
  type AgreementDraft,
  type AllianceDraft,
  type AllianceType,
  type ContactDraft,
  type ContractDraft,
  type ContractType,
  type ReminderDraft,
  type SignerDraft,
} from "@/features/alliances/lib/domain";
import {
  allianceTemplateValues,
  contractDocumentHtml,
  missingPlaceholders,
  overlayTemplateValues,
  parseTemplateDraft,
  placeholdersIn,
  renderTemplate,
  type TemplateDraft,
} from "@/features/alliances/lib/templates";
import { buildContractPdf, splitSignerPhone } from "@/features/alliances/lib/signature";
import { sendSignatureEnvelope } from "@/features/alliances/lib/signature.server";
import { syncSignatureByExternalRef } from "@/features/alliances/lib/signature-sync.server";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import { requireSession } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AllianceActionResult = { ok: true; id?: string } | { ok: false; error: string };
export type AllianceFileLinkResult = { ok: true; url: string } | { ok: false; error: string };

const SIGNED_URL_SECONDS = 120;

async function guard(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const isAdmin = userIsAllowedAdmin({ id: session.id, email: session.email });
  if (!funding.isStaff && !funding.isSuperAdmin && !isAdmin) {
    return { ok: false, error: "No tienes acceso a alianzas." };
  }
  return { ok: true, userId: session.id };
}

function refresh(allianceId?: string) {
  revalidatePath("/admin/alliances");
  revalidatePath("/alianzas");
  revalidatePath("/admin/alliances/plantillas");
  revalidatePath("/alianzas/plantillas");
  if (allianceId) {
    revalidatePath(`/admin/alliances/${allianceId}`);
    revalidatePath(`/alianzas/${allianceId}`);
  }
}

async function finish(allianceId: string) {
  try {
    const admin = createAdminClient();
    await admin.from("alliances").update({ updated_at: new Date().toISOString() }).eq("id", allianceId);
  } catch {
    // El registro hijo ya quedó guardado.
  }
  refresh(allianceId);
}

function failure(error: { code?: string; message?: string } | null, fallback: string): AllianceActionResult {
  if (!error) return { ok: false, error: fallback };
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42P01" || error.code === "PGRST205" || message.includes("alliance")) {
    return { ok: false, error: "Falta aplicar la migración de alianzas en la base de datos." };
  }
  return { ok: false, error: fallback };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function alliancePayload(draft: AllianceDraft) {
  return {
    name: draft.name,
    alliance_type: draft.allianceType,
    status: draft.status,
    owner_name: draft.ownerName,
    contact_name: nullable(draft.contactName),
    phone: nullable(draft.phone),
    email: nullable(draft.email),
    started_on: nullable(draft.startedOn),
    ends_on: nullable(draft.endsOn),
    summary: nullable(draft.summary),
    our_contribution: nullable(draft.ourContribution),
    their_contribution: nullable(draft.theirContribution),
    commission_terms: nullable(draft.commissionTerms),
    next_action: nullable(draft.nextAction),
  };
}

async function ownsChild(
  table: "alliance_contacts" | "alliance_agreements" | "alliance_contracts" | "alliance_activities" | "alliance_reminders" | "alliance_files",
  id: string,
  allianceId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from(table).select("id").eq("id", id).eq("alliance_id", allianceId).maybeSingle();
  return Boolean(data);
}

export async function saveAllianceAction(
  draft: AllianceDraft,
  allianceId?: string,
): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  const parsed = parseAllianceDraft(draft);
  if (!parsed.ok) return parsed;
  if (allianceId && !isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };

  try {
    const admin = createAdminClient();
    if (!allianceId) {
      const { data, error } = await admin
        .from("alliances")
        .insert({ ...alliancePayload(parsed.value), created_by: session.userId })
        .select("id")
        .single();
      if (error || !data) return failure(error, "No se pudo crear la alianza.");
      refresh(data.id);
      return { ok: true, id: data.id };
    }

    const { error } = await admin.from("alliances").update(alliancePayload(parsed.value)).eq("id", allianceId);
    if (error) return failure(error, "No se pudo guardar la alianza.");
    await finish(allianceId);
    return { ok: true, id: allianceId };
  } catch {
    return { ok: false, error: "No se pudo guardar la alianza." };
  }
}

export async function deleteAllianceAction(allianceId: string): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };

  try {
    const admin = createAdminClient();
    const [{ data: files }, { data: contracts }] = await Promise.all([
      admin.from("alliance_files").select("storage_path").eq("alliance_id", allianceId),
      admin.from("alliance_contracts").select("storage_path").eq("alliance_id", allianceId),
    ]);
    const paths = [
      ...((files ?? []) as { storage_path: string | null }[]),
      ...((contracts ?? []) as { storage_path: string | null }[]),
    ]
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path));
    if (paths.length > 0) await admin.storage.from(ALLIANCE_FILES_BUCKET).remove(paths);

    const { error } = await admin.from("alliances").delete().eq("id", allianceId);
    if (error) return failure(error, "No se pudo eliminar la alianza.");
    refresh(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar la alianza." };
  }
}

export async function saveContactAction(
  allianceId: string,
  draft: ContactDraft,
  contactId?: string,
): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };
  const parsed = parseContactDraft(draft);
  if (!parsed.ok) return parsed;

  try {
    const admin = createAdminClient();
    if (contactId) {
      if (!isAllianceId(contactId) || !(await ownsChild("alliance_contacts", contactId, allianceId))) {
        return { ok: false, error: "El contacto no pertenece a esta alianza." };
      }
    }
    if (parsed.value.isPrimary) {
      await admin.from("alliance_contacts").update({ is_primary: false }).eq("alliance_id", allianceId);
      await admin
        .from("alliances")
        .update({
          contact_name: parsed.value.name,
          phone: nullable(parsed.value.phone),
          email: nullable(parsed.value.email),
        })
        .eq("id", allianceId);
    }

    const payload = {
      alliance_id: allianceId,
      name: parsed.value.name,
      role_title: nullable(parsed.value.roleTitle),
      phone: nullable(parsed.value.phone),
      email: nullable(parsed.value.email),
      is_primary: parsed.value.isPrimary,
    };
    const query = contactId
      ? admin.from("alliance_contacts").update(payload).eq("id", contactId)
      : admin.from("alliance_contacts").insert(payload);
    const { error } = await query;
    if (error) return failure(error, "No se pudo guardar el contacto.");
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar el contacto." };
  }
}

export async function deleteContactAction(allianceId: string, contactId: string): Promise<AllianceActionResult> {
  return deleteChild("alliance_contacts", allianceId, contactId, "No se pudo eliminar el contacto.");
}

export async function saveAgreementAction(
  allianceId: string,
  draft: AgreementDraft,
  agreementId?: string,
): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };
  const parsed = parseAgreementDraft(draft);
  if (!parsed.ok) return parsed;
  if (agreementId && (!isAllianceId(agreementId) || !(await ownsChild("alliance_agreements", agreementId, allianceId)))) {
    return { ok: false, error: "El acuerdo no pertenece a esta alianza." };
  }

  try {
    const admin = createAdminClient();
    const payload = {
      alliance_id: allianceId,
      title: parsed.value.title,
      kind: parsed.value.kind,
      body: parsed.value.body,
    };
    const query = agreementId
      ? admin.from("alliance_agreements").update(payload).eq("id", agreementId)
      : admin.from("alliance_agreements").insert(payload);
    const { error } = await query;
    if (error) return failure(error, "No se pudo guardar el acuerdo.");
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar el acuerdo." };
  }
}

export async function deleteAgreementAction(allianceId: string, agreementId: string): Promise<AllianceActionResult> {
  return deleteChild("alliance_agreements", allianceId, agreementId, "No se pudo eliminar el acuerdo.");
}

export async function saveActivityAction(
  allianceId: string,
  draft: ActivityDraft,
  activityId?: string,
): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };
  const parsed = parseActivityDraft(draft);
  if (!parsed.ok) return parsed;
  if (activityId && (!isAllianceId(activityId) || !(await ownsChild("alliance_activities", activityId, allianceId)))) {
    return { ok: false, error: "La actividad no pertenece a esta alianza." };
  }

  try {
    const admin = createAdminClient();
    const payload = {
      alliance_id: allianceId,
      kind: parsed.value.kind,
      title: parsed.value.title,
      body: nullable(parsed.value.body),
      occurred_at: parsed.value.occurredAt,
      ...(activityId ? {} : { created_by: session.userId }),
    };
    const query = activityId
      ? admin.from("alliance_activities").update(payload).eq("id", activityId)
      : admin.from("alliance_activities").insert(payload);
    const { error } = await query;
    if (error) return failure(error, "No se pudo guardar la actividad.");
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar la actividad." };
  }
}

export async function deleteActivityAction(allianceId: string, activityId: string): Promise<AllianceActionResult> {
  return deleteChild("alliance_activities", allianceId, activityId, "No se pudo eliminar la actividad.");
}

export async function saveReminderAction(
  allianceId: string,
  draft: ReminderDraft,
  reminderId?: string,
): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };
  const parsed = parseReminderDraft(draft);
  if (!parsed.ok) return parsed;
  if (reminderId && (!isAllianceId(reminderId) || !(await ownsChild("alliance_reminders", reminderId, allianceId)))) {
    return { ok: false, error: "El recordatorio no pertenece a esta alianza." };
  }

  try {
    const admin = createAdminClient();
    const payload = {
      alliance_id: allianceId,
      title: parsed.value.title,
      due_on: parsed.value.dueOn,
      priority: parsed.value.priority,
      status: parsed.value.status,
      owner_name: nullable(parsed.value.ownerName),
      notes: nullable(parsed.value.notes),
    };
    const query = reminderId
      ? admin.from("alliance_reminders").update(payload).eq("id", reminderId)
      : admin.from("alliance_reminders").insert(payload);
    const { error } = await query;
    if (error) return failure(error, "No se pudo guardar el recordatorio.");
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar el recordatorio." };
  }
}

export async function deleteReminderAction(allianceId: string, reminderId: string): Promise<AllianceActionResult> {
  return deleteChild("alliance_reminders", allianceId, reminderId, "No se pudo eliminar el recordatorio.");
}

function readSigners(raw: FormDataEntryValue | null): SignerDraft[] | { error: string } {
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) return { error: "Los firmantes no se pudieron leer." };
    return parsed.map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        phone: String(row.phone ?? ""),
        roleTitle: String(row.roleTitle ?? ""),
        signedOn: String(row.signedOn ?? ""),
      };
    });
  } catch {
    return { error: "Los firmantes no se pudieron leer." };
  }
}

async function storeFile(
  allianceId: string,
  file: File,
): Promise<{ ok: true; path: string; name: string } | { ok: false; error: string }> {
  const allowed = isAllowedAllianceFile(file.name, file.size);
  if (!allowed.ok) return allowed;
  const path = `${allianceId}/${crypto.randomUUID()}-${safeStorageFileName(file.name)}`;
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(ALLIANCE_FILES_BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return { ok: false, error: "No se pudo guardar el archivo." };
  return { ok: true, path, name: file.name.slice(0, 180) };
}

export async function saveContractAction(formData: FormData): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  const allianceId = String(formData.get("allianceId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  if (!isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };
  if (contractId && (!isAllianceId(contractId) || !(await ownsChild("alliance_contracts", contractId, allianceId)))) {
    return { ok: false, error: "El contrato no pertenece a esta alianza." };
  }

  const signers = readSigners(formData.get("signers"));
  if (!Array.isArray(signers)) return { ok: false, error: signers.error };
  const parsed = parseContractDraft({
    contractType: String(formData.get("contractType") ?? "") as ContractDraft["contractType"],
    version: Number(formData.get("version") ?? 1),
    status: String(formData.get("status") ?? "") as ContractDraft["status"],
    sentOn: String(formData.get("sentOn") ?? ""),
    expiresOn: String(formData.get("expiresOn") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    signers,
  });
  if (!parsed.ok) return parsed;

  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  try {
    const admin = createAdminClient();
    let previousPath: string | null = null;
    if (contractId) {
      const existing = await admin
        .from("alliance_contracts")
        .select("storage_path")
        .eq("id", contractId)
        .maybeSingle();
      previousPath = (existing.data as { storage_path: string | null } | null)?.storage_path ?? null;
    }

    let uploaded: { path: string; name: string } | null = null;
    if (file) {
      const stored = await storeFile(allianceId, file);
      if (!stored.ok) return stored;
      uploaded = stored;
    }

    const payload = {
      alliance_id: allianceId,
      contract_type: parsed.value.contractType,
      version: parsed.value.version,
      status: parsed.value.status,
      sent_on: nullable(parsed.value.sentOn),
      expires_on: nullable(parsed.value.expiresOn),
      notes: nullable(parsed.value.notes),
      ...(contractId ? {} : { signature_provider: "manual" }),
      ...(uploaded
        ? {
            storage_path: uploaded.path,
            file_name: uploaded.name,
            mime_type: file?.type || null,
            size_bytes: file?.size ?? null,
          }
        : {}),
    };

    const saved = contractId
      ? await admin.from("alliance_contracts").update(payload).eq("id", contractId).select("id").single()
      : await admin.from("alliance_contracts").insert(payload).select("id").single();

    if (saved.error || !saved.data) {
      if (uploaded) await admin.storage.from(ALLIANCE_FILES_BUCKET).remove([uploaded.path]);
      return failure(saved.error, "No se pudo guardar el contrato.");
    }

    const id = saved.data.id as string;
    if (uploaded && previousPath && previousPath !== uploaded.path) {
      await admin.storage.from(ALLIANCE_FILES_BUCKET).remove([previousPath]);
    }

    await admin.from("alliance_contract_signers").delete().eq("contract_id", id);
    if (parsed.value.signers.length > 0) {
      const rows = parsed.value.signers.map((signer) => ({
        contract_id: id,
        name: signer.name,
        email: nullable(signer.email),
        phone: nullable(signer.phone),
        role_title: nullable(signer.roleTitle),
        signed_on: nullable(signer.signedOn),
      }));
      let { error } = await admin.from("alliance_contract_signers").insert(rows);
      if (isMissingPhoneColumn(error)) {
        if (parsed.value.signers.some((signer) => signer.phone)) {
          return { ok: false, error: "Falta aplicar la migración supabase/migrations/040_alliance_signatures.sql." };
        }
        ({ error } = await admin.from("alliance_contract_signers").insert(
          rows.map(({ phone, ...signer }) => {
            void phone;
            return signer;
          }),
        ));
      }
      if (error) return failure(error, "El contrato se guardó, pero los firmantes no.");
    }

    await finish(allianceId);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo guardar el contrato." };
  }
}

export async function deleteContractAction(allianceId: string, contractId: string): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(contractId)) {
    return { ok: false, error: "El contrato no existe." };
  }

  try {
    const admin = createAdminClient();
    const loaded = await admin
      .from("alliance_contracts")
      .select("storage_path, signature_storage_path, signed_storage_path")
      .eq("id", contractId)
      .eq("alliance_id", allianceId)
      .maybeSingle();
    const data = loaded.error
      ? (
          await admin
            .from("alliance_contracts")
            .select("storage_path")
            .eq("id", contractId)
            .eq("alliance_id", allianceId)
            .maybeSingle()
        ).data
      : loaded.data;
    if (!data) return { ok: false, error: "El contrato no pertenece a esta alianza." };
    const paths = [
      (data as { storage_path?: string | null }).storage_path,
      (data as { signature_storage_path?: string | null }).signature_storage_path,
      (data as { signed_storage_path?: string | null }).signed_storage_path,
      ...((await admin.from("alliance_files").select("storage_path").eq("contract_id", contractId)).data ?? []).map(
        (row) => (row as { storage_path: string | null }).storage_path,
      ),
    ].filter((item): item is string => Boolean(item));
    if (paths.length > 0) await admin.storage.from(ALLIANCE_FILES_BUCKET).remove(paths);
    const { error } = await admin.from("alliance_contracts").delete().eq("id", contractId);
    if (error) return failure(error, "No se pudo eliminar el contrato.");
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el contrato." };
  }
}

export async function uploadAllianceFileAction(formData: FormData): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  const allianceId = String(formData.get("allianceId") ?? "");
  if (!isAllianceId(allianceId)) return { ok: false, error: "La alianza no existe." };
  const category = parseFileCategory(String(formData.get("category") ?? "other"));
  if (!category.ok) return category;
  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
    return { ok: false, error: "Selecciona un archivo." };
  }

  const stored = await storeFile(allianceId, fileEntry);
  if (!stored.ok) return stored;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("alliance_files").insert({
      alliance_id: allianceId,
      name: stored.name,
      category: category.value,
      storage_path: stored.path,
      mime_type: fileEntry.type || null,
      size_bytes: fileEntry.size,
      created_by: session.userId,
    });
    if (error) {
      await admin.storage.from(ALLIANCE_FILES_BUCKET).remove([stored.path]);
      return failure(error, "No se pudo registrar el archivo.");
    }
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo registrar el archivo." };
  }
}

export async function deleteAllianceFileAction(allianceId: string, fileId: string): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(fileId)) return { ok: false, error: "El archivo no existe." };

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("alliance_files")
      .select("storage_path")
      .eq("id", fileId)
      .eq("alliance_id", allianceId)
      .maybeSingle();
    if (!data) return { ok: false, error: "El archivo no pertenece a esta alianza." };
    const path = (data as { storage_path: string }).storage_path;
    await admin.storage.from(ALLIANCE_FILES_BUCKET).remove([path]);
    const { error } = await admin.from("alliance_files").delete().eq("id", fileId);
    if (error) return failure(error, "No se pudo eliminar el archivo.");
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo eliminar el archivo." };
  }
}

async function signedPath(path: string): Promise<AllianceFileLinkResult> {
  const admin = createAdminClient();
  const signed = await admin.storage.from(ALLIANCE_FILES_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) return { ok: false, error: "No se pudo abrir el archivo." };
  return { ok: true, url: signed.data.signedUrl };
}

export async function openAllianceFileAction(allianceId: string, fileId: string): Promise<AllianceFileLinkResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(fileId)) return { ok: false, error: "El archivo no existe." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("alliance_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("alliance_id", allianceId)
    .maybeSingle();
  if (!data) return { ok: false, error: "El archivo no pertenece a esta alianza." };
  return signedPath((data as { storage_path: string }).storage_path);
}

export async function openContractFileAction(allianceId: string, contractId: string): Promise<AllianceFileLinkResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(contractId)) return { ok: false, error: "El contrato no existe." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("alliance_contracts")
    .select("storage_path")
    .eq("id", contractId)
    .eq("alliance_id", allianceId)
    .maybeSingle();
  const path = (data as { storage_path: string | null } | null)?.storage_path;
  if (!path) return { ok: false, error: "Este contrato no tiene archivo." };
  return signedPath(path);
}

export async function openSignedContractFileAction(allianceId: string, contractId: string): Promise<AllianceFileLinkResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(contractId)) return { ok: false, error: "El contrato no existe." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("alliance_contracts")
    .select("signed_storage_path")
    .eq("id", contractId)
    .eq("alliance_id", allianceId)
    .maybeSingle();
  const path = (data as { signed_storage_path?: string | null } | null)?.signed_storage_path;
  if (!path) return { ok: false, error: "Este contrato todavía no tiene el PDF firmado." };
  return signedPath(path);
}

export async function sendContractForSignatureAction(allianceId: string, contractId: string): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(contractId)) return { ok: false, error: "El contrato no existe." };

  try {
    const admin = createAdminClient();
    const loaded = await admin
      .from("alliance_contracts")
      .select("id, contract_type, version, status, expires_on, file_name, storage_path, mime_type, external_ref, alliance_contract_signers ( name, email, phone )")
      .eq("id", contractId)
      .eq("alliance_id", allianceId)
      .maybeSingle();
    if (loaded.error) return signatureFailure(loaded.error, "No se pudo leer el contrato.");
    if (!loaded.data) return { ok: false, error: "El contrato no pertenece a esta alianza." };

    const row = loaded.data as {
      contract_type: ContractType;
      version: number;
      status: string;
      expires_on: string | null;
      file_name: string | null;
      storage_path: string | null;
      mime_type: string | null;
      external_ref: string | null;
      alliance_contract_signers: { name: string; email: string | null; phone: string | null }[] | null;
    };
    if (row.status === "signed" || row.status === "renewed") {
      return { ok: false, error: "Este contrato ya está firmado." };
    }
    if (row.external_ref && row.status === "pending_signature") {
      return { ok: false, error: "Ya está en FirmEasy. Usa actualizar estado para traer las firmas." };
    }
    if (!row.storage_path) return { ok: false, error: "Genera o adjunta el documento antes de enviarlo a firma." };

    const prepared = prepareSigners(row.alliance_contract_signers ?? []);
    if (!prepared.ok) return prepared;

    const downloaded = await admin.storage.from(ALLIANCE_FILES_BUCKET).download(row.storage_path);
    if (downloaded.error || !downloaded.data) return { ok: false, error: "No se pudo leer el documento del contrato." };
    const source = new Uint8Array(await downloaded.data.arrayBuffer());
    const pdf = contractPdf(source, row.mime_type ?? "");
    if (!pdf.ok) return pdf;

    const pdfName = safeStorageFileName(`${row.file_name || row.contract_type}-v${row.version}.pdf`);
    const pdfPath = `${allianceId}/${crypto.randomUUID()}-${pdfName}`;
    const stored = await admin.storage.from(ALLIANCE_FILES_BUCKET).upload(pdfPath, pdf.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (stored.error) return { ok: false, error: "No se pudo preparar el PDF para la firma." };

    const today = todayInLima();
    const sent = await sendSignatureEnvelope({
      contractId,
      name: (row.file_name || `Contrato ${row.contract_type}`).replace(/\.(html|pdf)$/i, ""),
      pdf: pdf.bytes,
      deadline: row.expires_on && row.expires_on > today ? `${row.expires_on}T23:59:59-05:00` : "",
      signers: prepared.signers.map((signer, index) => ({ ...signer, page: pdf.pages, slot: index })),
    });
    if (!sent.ok) {
      await admin.storage.from(ALLIANCE_FILES_BUCKET).remove([pdfPath]);
      return sent;
    }

    const marked = await admin
      .from("alliance_contracts")
      .update({
        external_ref: sent.envelope.token,
        signature_provider: "firmeasy",
        status: "pending_signature",
        sent_on: today,
        provider_status: sent.envelope.status,
        rejection_reason: null,
        signature_storage_path: pdfPath,
      })
      .eq("id", contractId);
    if (marked.error) {
      return signatureFailure(marked.error, "FirmEasy creó la solicitud, pero no se pudo guardar el identificador. No la reenvíes todavía.");
    }

    const localSigners = await admin.from("alliance_contract_signers").select("id, email").eq("contract_id", contractId);
    for (const signer of (localSigners.data ?? []) as { id: string; email: string | null }[]) {
      const match = sent.envelope.signers.find((item) => item.email === (signer.email ?? "").trim().toLowerCase());
      if (!match) continue;
      await admin
        .from("alliance_contract_signers")
        .update({ external_ref: match.token || null, sign_url: match.link || null, provider_status: match.status || "pending" })
        .eq("id", signer.id);
    }

    await admin.from("alliance_activities").insert({
      alliance_id: allianceId,
      kind: "change",
      title: "Contrato enviado a firma",
      body: `La versión ${row.version} quedó en FirmEasy.`,
      occurred_at: new Date().toISOString(),
      created_by: session.userId,
    });
    await finish(allianceId);
    return { ok: true, id: contractId };
  } catch {
    return { ok: false, error: "No se pudo enviar el contrato a firma." };
  }
}

export async function refreshContractSignatureAction(allianceId: string, contractId: string): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(contractId)) return { ok: false, error: "El contrato no existe." };
  const admin = createAdminClient();
  const loaded = await admin
    .from("alliance_contracts")
    .select("external_ref")
    .eq("id", contractId)
    .eq("alliance_id", allianceId)
    .maybeSingle();
  const externalRef = (loaded.data as { external_ref?: string | null } | null)?.external_ref ?? "";
  if (!externalRef) return { ok: false, error: "Este contrato todavía no se envió a FirmEasy." };
  const synced = await syncSignatureByExternalRef(externalRef);
  if (!synced.ok) return synced;
  await finish(allianceId);
  return { ok: true, id: contractId };
}

function prepareSigners(
  rows: { name: string; email: string | null; phone: string | null }[],
): { ok: true; signers: { name: string; email: string; countryCode: string; phone: string }[] } | { ok: false; error: string } {
  const signers = [];
  for (const row of rows) {
    const email = (row.email ?? "").trim().toLowerCase();
    const phone = splitSignerPhone(row.phone ?? "");
    if (!email || !phone) {
      return { ok: false, error: "Cada firmante necesita correo y celular antes de enviarlo a FirmEasy." };
    }
    signers.push({ name: row.name.trim(), email, countryCode: phone.countryCode, phone: phone.phone });
  }
  if (signers.length === 0) return { ok: false, error: "Agrega al menos un firmante con correo y celular." };
  return { ok: true, signers };
}

function contractPdf(
  bytes: Uint8Array,
  mime: string,
): { ok: true; bytes: Uint8Array; pages: number } | { ok: false; error: string } {
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (mime.includes("pdf") || head === "%PDF-") return { ok: true, bytes, pages: pdfPageCount(bytes) };
  const looksHtml = mime.includes("html") || head.trimStart().startsWith("<");
  if (!looksHtml) return { ok: false, error: "Para firmar hace falta el borrador HTML o un PDF." };
  const built = buildContractPdf(Buffer.from(bytes).toString("utf8"));
  return { ok: true, bytes: built.bytes, pages: built.pages };
}

function pdfPageCount(bytes: Uint8Array): number {
  const matches = Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page(?!s)/g);
  return Math.min(Math.max(matches?.length ?? 1, 1), 30);
}

function isMissingPhoneColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || message.includes("phone") || message.includes("column");
}

function signatureFailure(error: { code?: string; message?: string } | null, fallback: string): AllianceActionResult {
  const message = (error?.message ?? "").toLowerCase();
  if (error?.code === "42703" || error?.code === "PGRST204" || message.includes("column")) {
    return { ok: false, error: "Falta aplicar la migración supabase/migrations/040_alliance_signatures.sql." };
  }
  return failure(error, fallback);
}

async function deleteChild(
  table: "alliance_contacts" | "alliance_agreements" | "alliance_activities" | "alliance_reminders",
  allianceId: string,
  id: string,
  fallback: string,
): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(allianceId) || !isAllianceId(id) || !(await ownsChild(table, id, allianceId))) {
    return { ok: false, error: "El registro no pertenece a esta alianza." };
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin.from(table).delete().eq("id", id);
    if (error) return failure(error, fallback);
    await finish(allianceId);
    return { ok: true };
  } catch {
    return { ok: false, error: fallback };
  }
}

function templateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "plantilla"}-${crypto.randomUUID().slice(0, 8)}`;
}

function refreshTemplates() {
  revalidatePath("/admin/alliances/plantillas");
  revalidatePath("/alianzas/plantillas");
}

export async function saveTemplateAction(
  draft: TemplateDraft,
  templateId?: string,
): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  const parsed = parseTemplateDraft(draft);
  if (!parsed.ok) return parsed;
  if (templateId && !isAllianceId(templateId)) return { ok: false, error: "La plantilla no existe." };

  try {
    const admin = createAdminClient();
    const payload = {
      name: parsed.value.name,
      contract_type: parsed.value.contractType,
      description: parsed.value.description || null,
      body: parsed.value.body,
      is_active: parsed.value.active,
    };
    const saved = templateId
      ? await admin.from("alliance_contract_templates").update(payload).eq("id", templateId).select("id").single()
      : await admin
          .from("alliance_contract_templates")
          .insert({ ...payload, slug: templateSlug(parsed.value.name) })
          .select("id")
          .single();
    if (saved.error || !saved.data) {
      const message = (saved.error?.message ?? "").toLowerCase();
      if (saved.error?.code === "42P01" || saved.error?.code === "PGRST205" || message.includes("template")) {
        return { ok: false, error: "Falta aplicar la migración de plantillas: supabase/migrations/039_alliance_contract_templates.sql." };
      }
      return { ok: false, error: "No se pudo guardar la plantilla." };
    }
    refreshTemplates();
    return { ok: true, id: saved.data.id as string };
  } catch {
    return { ok: false, error: "No se pudo guardar la plantilla." };
  }
}

export async function generateContractAction(input: {
  allianceId: string;
  templateId: string;
  values: Record<string, string>;
  expiresOn: string;
}): Promise<AllianceActionResult> {
  const session = await guard();
  if (!session.ok) return session;
  if (!isAllianceId(input.allianceId) || !isAllianceId(input.templateId)) {
    return { ok: false, error: "No se pudo identificar la alianza o la plantilla." };
  }

  const expiresOn = input.expiresOn.trim();
  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) {
    return { ok: false, error: "El vencimiento no es una fecha válida." };
  }

  try {
    const admin = createAdminClient();
    const [{ data: template, error: templateError }, { data: alliance, error: allianceError }, { data: versions }] =
      await Promise.all([
        admin
          .from("alliance_contract_templates")
          .select("id, name, contract_type, body, is_active")
          .eq("id", input.templateId)
          .maybeSingle(),
        admin
          .from("alliances")
          .select(
            "name, alliance_type, owner_name, contact_name, email, phone, commission_terms, started_on, ends_on, our_contribution, their_contribution, summary",
          )
          .eq("id", input.allianceId)
          .maybeSingle(),
        admin.from("alliance_contracts").select("version").eq("alliance_id", input.allianceId),
      ]);

    if (templateError || allianceError) {
      const message = `${templateError?.message ?? ""} ${allianceError?.message ?? ""}`.toLowerCase();
      if (templateError?.code === "42P01" || templateError?.code === "PGRST205" || message.includes("template")) {
        return { ok: false, error: "Falta aplicar la migración de plantillas: supabase/migrations/039_alliance_contract_templates.sql." };
      }
      return { ok: false, error: "No se pudo preparar el contrato." };
    }
    if (!template || !template.is_active) return { ok: false, error: "Esa plantilla no está disponible." };
    if (!alliance) return { ok: false, error: "La alianza no existe." };

    const row = alliance as {
      name: string;
      alliance_type: AllianceType;
      owner_name: string;
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      commission_terms: string | null;
      started_on: string | null;
      ends_on: string | null;
      our_contribution: string | null;
      their_contribution: string | null;
      summary: string | null;
    };
    const today = todayInLima();
    const keys = placeholdersIn(String(template.body));
    const values = overlayTemplateValues(
      allianceTemplateValues({
        name: row.name,
        typeLabel: ALLIANCE_TYPE_LABEL[row.alliance_type],
        ownerName: row.owner_name,
        contactName: row.contact_name ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
        commissionTerms: row.commission_terms ?? "",
        startedOnLabel: row.started_on ? formatAllianceDate(row.started_on) : "",
        endsOnLabel: row.ends_on ? formatAllianceDate(row.ends_on) : "",
        ourContribution: row.our_contribution ?? "",
        theirContribution: row.their_contribution ?? "",
        summary: row.summary ?? "",
        todayLabel: formatAllianceDate(today),
      }),
      input.values ?? {},
      keys,
    );
    const missing = missingPlaceholders(String(template.body), values);
    if (missing.length > 0) {
      return { ok: false, error: "Completa los datos que la plantilla usa antes de generar." };
    }

    const rendered = renderTemplate(String(template.body), values);
    const html = contractDocumentHtml({
      title: String(template.name),
      parties: `${row.name} · ${values.hoy || today}`,
      body: rendered,
    });
    const version = Math.max(0, ...((versions ?? []) as { version: number }[]).map((item) => Number(item.version) || 0)) + 1;
    const fileName = safeStorageFileName(`${String(template.name)}-v${version}.html`);
    const path = `${input.allianceId}/${crypto.randomUUID()}-${fileName}`;
    const bytes = Buffer.from(html, "utf8");
    const uploaded = await admin.storage.from(ALLIANCE_FILES_BUCKET).upload(path, bytes, {
      contentType: "text/html; charset=utf-8",
      upsert: false,
    });
    if (uploaded.error) return { ok: false, error: "No se pudo guardar el documento generado." };

    const inserted = await admin
      .from("alliance_contracts")
      .insert({
        alliance_id: input.allianceId,
        template_id: template.id,
        contract_type: template.contract_type as ContractType,
        version,
        status: "draft",
        expires_on: expiresOn || null,
        notes: `Generado desde la plantilla ${String(template.name)}.`,
        storage_path: path,
        file_name: fileName,
        mime_type: "text/html",
        size_bytes: bytes.byteLength,
        signature_provider: "manual",
      })
      .select("id")
      .single();

    if (inserted.error || !inserted.data) {
      await admin.storage.from(ALLIANCE_FILES_BUCKET).remove([path]);
      return { ok: false, error: "No se pudo crear el contrato." };
    }

    const signers = [
      values.responsable ? { name: values.responsable, role_title: "Holistic Marketing", email: null, phone: null } : null,
      values.contacto
        ? { name: values.contacto, role_title: row.name, email: values.correo || null, phone: values.telefono || null }
        : null,
    ].filter((signer): signer is { name: string; role_title: string; email: string | null; phone: string | null } =>
      Boolean(signer && signer.name.trim().length >= 2),
    );

    if (signers.length > 0) {
      const rows = signers.map((signer) => ({ contract_id: inserted.data.id, ...signer }));
      let { error } = await admin.from("alliance_contract_signers").insert(rows);
      if (isMissingPhoneColumn(error)) {
        ({ error } = await admin.from("alliance_contract_signers").insert(
          rows.map(({ phone, ...signer }) => {
            void phone;
            return signer;
          }),
        ));
      }
      if (error) return { ok: false, error: "El contrato se creó, pero los firmantes no." };
    }

    await finish(input.allianceId);
    return { ok: true, id: inserted.data.id as string };
  } catch {
    return { ok: false, error: "No se pudo generar el contrato." };
  }
}
