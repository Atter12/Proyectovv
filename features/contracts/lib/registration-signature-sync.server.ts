import "server-only";
import { downloadSignedPdf, fetchSignatureEnvelope } from "@/features/alliances/lib/signature.server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "registration-contracts";

export async function syncRegistrationSignature(
  externalRef: string,
): Promise<{ ok: true; ignored?: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const existing = await admin
    .from("client_service_contracts")
    .select("id, status, signed_storage_path")
    .eq("external_ref", externalRef)
    .maybeSingle<{ id: string; status: string; signed_storage_path: string | null }>();
  if (existing.error) return { ok: false, error: "No se pudo ubicar el contrato de registro." };
  if (!existing.data) return { ok: true, ignored: true };

  const remote = await fetchSignatureEnvelope(externalRef);
  if (!remote.ok) return remote;
  const row = existing.data;
  let signedPath = row.signed_storage_path;
  if (remote.envelope.status === "signed" && !signedPath) {
    if (!remote.envelope.signedDownloadUrl) {
      return { ok: false, error: "FirmEasy marcó el contrato como firmado, pero el PDF todavía no está listo." };
    }
    const file = await downloadSignedPdf(remote.envelope.signedDownloadUrl);
    if (!file.ok) return file;
    signedPath = `${row.id}/${crypto.randomUUID()}-firmado.pdf`;
    const uploaded = await admin.storage.from(BUCKET).upload(signedPath, file.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploaded.error) return { ok: false, error: "No se pudo guardar el PDF firmado." };
  }

  const status =
    remote.envelope.status === "signed"
      ? "signed"
      : remote.envelope.status === "rejected"
        ? "rejected"
        : row.status;
  const saved = await admin
    .from("client_service_contracts")
    .update({
      status,
      ...(signedPath && signedPath !== row.signed_storage_path ? { signed_storage_path: signedPath } : {}),
      ...(status === "signed" && row.status !== "signed" ? { signed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (saved.error) return { ok: false, error: "No se pudo actualizar la firma del registro." };
  return { ok: true };
}
