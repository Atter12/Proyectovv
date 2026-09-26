"use server";

import { revalidatePath } from "next/cache";
import {
  ALLIANCE_FILES_BUCKET,
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
  type ActivityDraft,
  type AgreementDraft,
  type AllianceDraft,
  type ContactDraft,
  type ContractDraft,
  type ReminderDraft,
  type SignerDraft,
} from "@/features/alliances/lib/domain";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type AllianceActionResult = { ok: true; id?: string } | { ok: false; error: string };
export type AllianceFileLinkResult = { ok: true; url: string } | { ok: false; error: string };

const SIGNED_URL_SECONDS = 120;

async function guard(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "No tienes acceso de administración." };
  return { ok: true, userId: admin.id };
}

function refresh(allianceId?: string) {
  revalidatePath("/admin/alliances");
  if (allianceId) revalidatePath(`/admin/alliances/${allianceId}`);
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
      const { error } = await admin.from("alliance_contract_signers").insert(
        parsed.value.signers.map((signer) => ({
          contract_id: id,
          name: signer.name,
          email: nullable(signer.email),
          role_title: nullable(signer.roleTitle),
          signed_on: nullable(signer.signedOn),
        })),
      );
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
    const { data } = await admin
      .from("alliance_contracts")
      .select("storage_path")
      .eq("id", contractId)
      .eq("alliance_id", allianceId)
      .maybeSingle();
    if (!data) return { ok: false, error: "El contrato no pertenece a esta alianza." };
    const path = (data as { storage_path: string | null }).storage_path;
    const { data: linked } = await admin.from("alliance_files").select("storage_path").eq("contract_id", contractId);
    const paths = [path, ...((linked ?? []) as { storage_path: string | null }[]).map((row) => row.storage_path)].filter(
      (item): item is string => Boolean(item),
    );
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
