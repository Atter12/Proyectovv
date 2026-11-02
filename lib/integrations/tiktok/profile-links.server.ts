import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJson, encryptJson } from "@/lib/crypto/encryption.server";

// Private, service-managed bucket. Payloads are also encrypted; paths contain no PII.
export const PROFILE_LINKS_BUCKET = "tiktok-profile-links";
export type SavedTikTokProfile = {
  id: string; bcId: string; assetId: string; name: string; createdAt: string;
  disconnectedAt?: string;
  revision?: string;
};
type Claim = SavedTikTokProfile & { clienteId: string; userId: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const folder = (clienteId: string) => `clients/${hash(clienteId)}`;
const claimPath = (bcId: string, assetId: string) => `claims/${hash(JSON.stringify([bcId, assetId]))}.json`;
const storage = () => createAdminClient().storage.from(PROFILE_LINKS_BUCKET);
const publicProfile = ({ id, bcId, assetId, name, createdAt, disconnectedAt, revision }: Claim): SavedTikTokProfile => ({ id, bcId, assetId, name, createdAt, ...(disconnectedAt ? { disconnectedAt } : {}), ...(revision ? { revision } : {}) });
function storageError() { return new Error("No pudimos consultar los perfiles guardados. Reintenta; si continúa, soporte debe revisar el almacenamiento de vinculaciones TikTok."); }
async function read(path: string): Promise<Claim> {
  // Claims can be revoked/reactivated: never reuse an earlier CDN/cache response.
  const { data, error } = await storage().download(path, { cacheNonce: randomUUID() }, { cache: "no-store" });
  if (error || !data) throw storageError();
  try {
    const claim = decryptJson<Claim>(await data.text());
    if (![claim.id, claim.clienteId, claim.bcId, claim.assetId, claim.name, claim.createdAt, claim.userId].every((v) => typeof v === "string" && v.length)) throw storageError();
    return claim;
  } catch { throw storageError(); }
}
export async function listSavedTikTokProfiles(clienteId: string) {
  const { data, error } = await storage().list(folder(clienteId), { limit: 101, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw storageError();
  if ((data?.length ?? 0) > 100) throw new Error("Hay demasiados perfiles para mostrarlos. Contacta a soporte.");
  const profiles: SavedTikTokProfile[] = [];
  for (let offset = 0; offset < (data?.length ?? 0); offset += 5) {
    const batch = await Promise.all(data!.slice(offset, offset + 5).map((file) => getSavedTikTokProfile(clienteId, file.name.replace(/\.json$/, ""))));
    profiles.push(...batch);
  }
  return profiles.filter((profile) => !profile.disconnectedAt);
}
export async function getSavedTikTokProfile(clienteId: string, id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Selecciona un perfil guardado de este cliente.");
  const index = await read(`${folder(clienteId)}/${id}.json`);
  if (index.clienteId !== clienteId || index.id !== id) throw new Error("Este perfil no pertenece al cliente seleccionado.");
  // The global atomic claim is authoritative, including after a partial index write.
  const claim = await read(claimPath(index.bcId, index.assetId));
  if (claim.clienteId !== clienteId || claim.id !== id || claim.bcId !== index.bcId || claim.assetId !== index.assetId) throw new Error("Soporte debe validar la titularidad de este perfil.");
  return publicProfile(claim);
}
export async function saveTikTokProfile(input: { clienteId: string; userId: string; bcId: string; assetId: string; name: string }) {
  const path = claimPath(input.bcId, input.assetId);
  let claim: Claim = { ...input, id: randomUUID(), createdAt: new Date().toISOString(), revision: randomUUID() };
  // Atomic create, never overwrite another client's global BC/asset claim.
  const created = await storage().upload(path, encryptJson(claim), { contentType: "application/json", cacheControl: "0", upsert: false });
  if (created.error) {
    if (String(created.error.statusCode) !== "409" && !(String(created.error.statusCode) === "400" && /already exists|duplicate/i.test(created.error.message))) throw storageError();
    claim = await read(path);
    if (claim.clienteId !== input.clienteId || claim.bcId !== input.bcId || claim.assetId !== input.assetId) throw new Error("Este perfil ya está registrado con otro cliente. Soporte debe validar la titularidad antes de continuar.");
    if (claim.disconnectedAt) {
      // A fresh verified QR can reactivate this client's own claim. Never transfer ownership.
      delete claim.disconnectedAt;
      claim.revision = randomUUID();
      const restored = await storage().upload(path, encryptJson(claim), { contentType: "application/json", cacheControl: "0", upsert: true });
      if (restored.error) throw storageError();
    }
  }
  // Retry repairs an interrupted index write using the same immutable claim/ID.
  const indexed = await storage().upload(`${folder(input.clienteId)}/${claim.id}.json`, encryptJson(claim), { contentType: "application/json", cacheControl: "0", upsert: true });
  if (indexed.error) throw storageError();
  return publicProfile(claim);
}

/** Call only after TikTok confirms the asset is absent. Retain ownership/audit history. */
export async function markTikTokProfileDisconnected(clienteId: string, id: string) {
  const saved = await getSavedTikTokProfile(clienteId, id);
  if (saved.disconnectedAt) return;
  const path = claimPath(saved.bcId, saved.assetId);
  const claim = await read(path);
  if (claim.clienteId !== clienteId || claim.id !== id) throw new Error("Cambió la titularidad del perfil. Contacta a soporte.");
  const updated = await storage().upload(path, encryptJson({ ...claim, disconnectedAt: new Date().toISOString(), revision: randomUUID() }), { contentType: "application/json", cacheControl: "0", upsert: true });
  if (updated.error) throw storageError();
}
