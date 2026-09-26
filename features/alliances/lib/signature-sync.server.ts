import "server-only";
import { revalidatePath } from "next/cache";
import { downloadSignedPdf, fetchSignatureEnvelope } from "@/features/alliances/lib/signature.server";
import type { RemoteEnvelope, RemoteSigner } from "@/features/alliances/lib/signature";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "alliance-files";

export async function syncSignatureByExternalRef(
  externalRef: string,
): Promise<{ ok: true; ignored?: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const existing = await admin
    .from("alliance_contracts")
    .select("id, alliance_id, version, status, signed_storage_path")
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (existing.error) return { ok: false, error: "No se pudo ubicar el contrato." };
  if (!existing.data) return { ok: true, ignored: true };

  const remote = await fetchSignatureEnvelope(externalRef);
  if (!remote.ok) return remote;

  const row = existing.data as {
    id: string;
    alliance_id: string;
    version: number;
    status: string;
    signed_storage_path: string | null;
  };
  const applied = await applyEnvelope(row, remote.envelope);
  if (!applied.ok) return applied;
  refreshAlliance(row.alliance_id);
  return { ok: true };
}

async function applyEnvelope(
  row: { id: string; alliance_id: string; version: number; status: string; signed_storage_path: string | null },
  envelope: RemoteEnvelope,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  let signedPath = row.signed_storage_path;
  let signedName = "";

  if (envelope.status === "signed" && !signedPath) {
    if (!envelope.signedDownloadUrl) {
      return { ok: false, error: "FirmEasy marcó el documento como firmado, pero todavía no hay PDF para descargar." };
    }
    const file = await downloadSignedPdf(envelope.signedDownloadUrl);
    if (!file.ok) return file;
    signedName = `firmado-v${row.version}.pdf`;
    signedPath = `${row.alliance_id}/${crypto.randomUUID()}-${signedName}`;
    const uploaded = await admin.storage.from(BUCKET).upload(signedPath, file.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploaded.error) return { ok: false, error: "No se pudo guardar el PDF firmado." };
  }

  const status = localStatus(envelope.status, row.status);
  const saved = await admin
    .from("alliance_contracts")
    .update({
      status,
      ...(envelope.status === "unknown" ? {} : { provider_status: envelope.status }),
      rejection_reason: envelope.rejectionReason || null,
      ...(signedName ? { signed_storage_path: signedPath, signed_file_name: signedName } : {}),
    })
    .eq("id", row.id);
  if (saved.error) {
    if (signedPath && signedPath !== row.signed_storage_path) await admin.storage.from(BUCKET).remove([signedPath]);
    return { ok: false, error: schemaError(saved.error, "No se pudo actualizar el estado de firma.") };
  }

  const signers = await admin.from("alliance_contract_signers").select("id, email, name").eq("contract_id", row.id);
  if (!signers.error && signers.data) {
    for (const signer of signers.data as { id: string; email: string | null; name: string }[]) {
      const match = matchSigner(envelope.signers, signer.email ?? "", signer.name);
      if (!match) continue;
      await admin
        .from("alliance_contract_signers")
        .update({
          external_ref: match.token || null,
          sign_url: match.link || null,
          provider_status: match.status || null,
          ...(match.signedOn ? { signed_on: match.signedOn } : {}),
        })
        .eq("id", signer.id);
    }
  }

  if (envelope.status === "signed" && row.status !== "signed") {
    await admin.from("alliance_activities").insert({
      alliance_id: row.alliance_id,
      kind: "change",
      title: "Contrato firmado",
      body: `FirmEasy confirmó la firma de la versión ${row.version}.`,
      occurred_at: new Date().toISOString(),
    });
  }
  if (envelope.status === "rejected" && row.status !== "in_review") {
    await admin.from("alliance_activities").insert({
      alliance_id: row.alliance_id,
      kind: "incident",
      title: "Firma rechazada",
      body: envelope.rejectionReason || `Un firmante rechazó la versión ${row.version}.`,
      occurred_at: new Date().toISOString(),
    });
  }

  return { ok: true };
}

function localStatus(remote: RemoteEnvelope["status"], current: string): string {
  if (remote === "signed") return "signed";
  if (remote === "rejected") return "in_review";
  if (remote === "pending") return "pending_signature";
  return current;
}

function matchSigner(signers: RemoteSigner[], email: string, name: string): RemoteSigner | undefined {
  const mail = email.trim().toLowerCase();
  if (mail) {
    const byEmail = signers.find((signer) => signer.email === mail);
    if (byEmail) return byEmail;
  }
  const normalized = name.trim().toLowerCase();
  return signers.find((signer) => signer.name.trim().toLowerCase() === normalized);
}

function schemaError(error: { code?: string; message?: string }, fallback: string): string {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42703" || error.code === "PGRST204" || message.includes("column")) {
    return "Falta aplicar la migración supabase/migrations/040_alliance_signatures.sql.";
  }
  return fallback;
}

function refreshAlliance(allianceId: string) {
  revalidatePath("/admin/alliances");
  revalidatePath("/alianzas");
  revalidatePath(`/admin/alliances/${allianceId}`);
  revalidatePath(`/alianzas/${allianceId}`);
}
