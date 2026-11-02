import "server-only";
import { tiktokRequest, TikTokApiError } from "./http.server";
import { resolveTikTokFinanceAccessToken } from "./bc-finance.server";
import { encryptJson, decryptJson } from "@/lib/crypto/encryption.server";

export const QR_PATH = "/bc/asset/account/authorization/";
export const ASSIGN_PATH = "/bc/asset/advertiser/assign/";
export const UNASSIGN_PATH = "/bc/asset/advertiser/unassign/";
export const REMOVE_PROFILE_PATH = "/bc/asset/admin/delete/";
type Page = { list?: Record<string, unknown>[]; page_info?: { total_page?: number } };
export type QrSession = {
  userId: string; clienteId: string; bcId: string; profileName: string;
  advertiserIds: string[]; baseline: string[]; expiresAt: number;
  ownedAssetIds?: string[];
};
export async function bcCall<T>(path: string, bcId: string, params: Record<string, unknown> = {}, method: "GET" | "POST" = "GET") {
  const { token } = await resolveTikTokFinanceAccessToken();
  return tiktokRequest<T>({ path, accessToken: token, method, ...(method === "GET" ? { query: { bc_id: bcId, ...params } } : { body: { bc_id: bcId, ...params } }) });
}
export async function listBcTikTokAssets(bcId: string) {
  const assets: Record<string, unknown>[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await bcCall<Page>("/bc/asset/admin/get/", bcId, { asset_type: "TT_ACCOUNT", page, page_size: 50 });
    assets.push(...(result.list ?? []));
    if (page >= (result.page_info?.total_page ?? 1)) return assets;
  }
  throw new Error("TikTok devolvió demasiadas páginas. Reintenta más tarde.");
}
export async function assignedAdvertisers(bcId: string, assetId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await bcCall<Page>("/bc/asset/advertiser/assigned/", bcId, { asset_type: "TT_ACCOUNT", asset_id: assetId, page, page_size: 50 });
    ids.push(...(result.list ?? []).map((row) => String(row.advertiser_id ?? "")));
    if (page >= (result.page_info?.total_page ?? 1)) return ids;
  }
  throw new Error("No se pudo completar la consulta de vinculaciones.");
}
export async function startQrSession(input: Omit<QrSession, "baseline" | "expiresAt">) {
  const assets = await listBcTikTokAssets(input.bcId);
  const result = await bcCall<{ bc_auth_qr_code?: string }>(QR_PATH, input.bcId, { is_ads_only_mode: true }, "POST");
  if (!result.bc_auth_qr_code) throw new Error("TikTok no devolvió la URL para generar el QR.");
  const session: QrSession = { ...input, baseline: assets.map((asset) => String(asset.asset_id)), expiresAt: Date.now() + 10 * 60_000 };
  return { ticket: encryptJson(session), authorizationUrl: result.bc_auth_qr_code, expiresAt: session.expiresAt };
}
export function readQrSession(ticket: string, userId: string, clienteId: string) {
  let session: QrSession;
  try { session = decryptJson<QrSession>(ticket); } catch { throw new Error("La sesión del QR no es válida. Genera otro QR."); }
  if (session.userId !== userId || session.clienteId !== clienteId) throw new Error("El QR pertenece a otra sesión o cliente. Genera otro QR.");
  if (session.expiresAt < Date.now()) throw new Error("La sesión del QR venció. Genera otro QR y vuelve a escanearlo.");
  return session;
}
type DisconnectSession = {
  purpose: "disconnect-tiktok-profile"; userId: string; clienteId: string;
  profileId: string; bcId: string; assetId: string; profileRevision: string; assignedIds: string[]; expiresAt: number;
};
export function createDisconnectTicket(input: Omit<DisconnectSession, "purpose" | "expiresAt">) {
  return encryptJson({ ...input, purpose: "disconnect-tiktok-profile", expiresAt: Date.now() + 5 * 60_000 });
}
export function readDisconnectTicket(ticket: string, userId: string, clienteId: string, profileId: string) {
  let session: DisconnectSession;
  try { session = decryptJson<DisconnectSession>(ticket); } catch { throw new Error("La confirmación no es válida. Vuelve a elegir Desvincular perfil."); }
  if (session.purpose !== "disconnect-tiktok-profile" || session.userId !== userId || session.clienteId !== clienteId || session.profileId !== profileId || !Number.isFinite(session.expiresAt) || session.expiresAt < Date.now() || !Array.isArray(session.assignedIds)) {
    throw new Error("La confirmación venció o corresponde a otro cliente. Vuelve a elegir Desvincular perfil.");
  }
  return session;
}
/** Never return the agency's asset list. Only a new asset matching the exact name.
 * Existing assets are eligible only if already assigned to one of this client's ads.
 */
export async function findAuthorizedProfile(session: QrSession) {
  const assets = await listBcTikTokAssets(session.bcId);
  const normalize = (name: string) => name.normalize("NFKC").trim().toLowerCase();
  // No profile enumeration: the name is locked into the encrypted ticket at QR creation.
  const ordered = assets.filter((asset) => normalize(String(asset.asset_name ?? "")) === normalize(session.profileName));
  if (ordered.length > 1) throw new Error("Hay varios perfiles con ese nombre en el centro. Soporte debe validar cuál corresponde antes de vincularlo.");
  for (const asset of ordered) {
    const assetId = String(asset.asset_id ?? "");
    const isNew = !session.baseline.includes(assetId);
    if (!isNew) {
      const linked = await assignedAdvertisers(session.bcId, assetId);
      if (!session.ownedAssetIds?.includes(assetId) && !linked.some((id) => session.advertiserIds.includes(id))) continue;
    }
    {
      if (isNew) {
        const linked = await assignedAdvertisers(session.bcId, assetId);
        if (linked.some((id) => !session.advertiserIds.includes(id))) {
          throw new Error("Este perfil ya está vinculado a otras cuentas ads. Soporte debe validar su asignación antes de continuar.");
        }
      }
      return { assetId, name: String(asset.asset_name) };
    }
  }
  return null;
}
export function qrError(error: unknown) {
  const detail = error instanceof Error ? error.message : "No se pudo completar la solicitud.";
  const permission = /permission|scope|access denied|forbidden|not granted|not authorized|auth is not enough/i.test(detail);
  return {
    error: permission ? "TikTok requiere que Holistic revise el acceso para completar esta operación. Contacta a soporte con la referencia del error." : detail,
    detail, code: permission ? "TIKTOK_PERMISSION_REQUIRED" : "TIKTOK_QR_FAILED",
    ...(error instanceof TikTokApiError ? { endpoint: error.path, providerCode: error.code, requestId: error.requestId } : {}),
    ...(permission ? { required: "Marketing API → Business Center → BC Assets; usuario del token con rol ADMIN en el Business Center." } : {}),
  };
}
