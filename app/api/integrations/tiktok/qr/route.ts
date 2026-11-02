import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";
import { resolveTikTokCreateBmForCliente } from "@/lib/integrations/tiktok/bc-create-profiles";
import { ASSIGN_PATH, UNASSIGN_PATH, REMOVE_PROFILE_PATH, assignedAdvertisers, bcCall, createDisconnectTicket, findAuthorizedProfile, listBcTikTokAssets, qrError, readDisconnectTicket, readQrSession, startQrSession } from "@/lib/integrations/tiktok/bc-tiktok-qr.server";
import { getSavedTikTokProfile, listSavedTikTokProfiles, markTikTokProfileDisconnected, saveTikTokProfile } from "@/lib/integrations/tiktok/profile-links.server";

export const maxDuration = 60;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function context() {
  const session = await getSession();
  if (!session || session.profileStatus !== "active") throw new Error("Inicia sesión para vincular tu TikTok.");
  if (!hasPermission(session.permissions, "adAccounts:create")) throw new Error("Tu usuario no tiene permiso para vincular cuentas. Solicita acceso al administrador de Holistic.");
  const cliente = await getSelectedHecomCliente(session.id);
  if (!cliente) throw new Error("Selecciona un cliente antes de vincular TikTok.");
  const overview = await getHecomClienteAdAccountsOverview(cliente.id, "fast");
  const ownedAccounts = overview.accounts.filter((account) => account.externalAccountId)
    .map((account) => ({ id: account.externalAccountId!, name: account.name, bcId: HECOM_BM_BUCKET_TO_BC[account.externalBusinessId ?? ""] ?? "", bm: account.externalBusinessId, status: account.status }))
    .filter((account) => account.bcId);
  const accounts = ownedAccounts.filter((account) => account.status === "active");
  return { session, cliente, accounts, ownedAccounts };
}

export async function GET() {
  try { const { accounts, ownedAccounts, cliente } = await context(); return reply({ accounts, manageableAccounts: ownedAccounts, profiles: await listSavedTikTokProfiles(cliente.id) }); }
  catch (error) { return reply(qrError(error), 400); }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Origen de solicitud no permitido." }, 403);
  let action = "unknown";
  try {
    const { session, cliente, accounts, ownedAccounts } = await context();
    const input = await request.json();
    if (["profile", "assign", "unassign", "disconnect-preview", "disconnect", "start", "status", "link"].includes(input.action)) action = input.action;
    const ids: string[] = Array.isArray(input.advertiserIds) ? [...new Set<string>(input.advertiserIds.filter((id: unknown): id is string => typeof id === "string"))] : [];
    const chosen = (input.action === "unassign" ? ownedAccounts : accounts).filter((account) => ids.includes(account.id));
    if (chosen.length !== ids.length) return reply({ error: "Elige cuentas ads activas de este cliente." }, 400);
    if (["profile", "assign", "unassign", "disconnect-preview", "disconnect"].includes(input.action)) {
      if (typeof input.profileId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.profileId)) return reply({ error: "Selecciona un perfil guardado." }, 400);
      const saved = await getSavedTikTokProfile(cliente.id, input.profileId);
      if (chosen.some((account) => account.bcId !== saved.bcId)) return reply({ error: "Estas cuentas necesitan otra autorización. Puedes vincularlas desde Adsholistic con un nuevo QR." }, 400);
      const assets = await listBcTikTokAssets(saved.bcId);
      const present = assets.some((asset) => String(asset.asset_id) === saved.assetId);
      const assigned = present ? await assignedAdvertisers(saved.bcId, saved.assetId) : [];
      if (input.action === "profile") {
        return reply({ profile: saved, linked: present && !saved.disconnectedAt, verifiedAt: new Date().toISOString(), assignedIds: assigned.filter((id) => ownedAccounts.some((a) => a.id === id && a.bcId === saved.bcId)) });
      }
      if (input.action === "disconnect-preview" || input.action === "disconnect") {
        // Revoking the BC affects every linked advertiser: never affect another client's accounts.
        if (assigned.some((id) => !ownedAccounts.some((a) => a.id === id && a.bcId === saved.bcId))) return reply({ error: "Hay vinculaciones fuera de las cuentas de este cliente. Soporte debe validarlas antes de desconectar el perfil." }, 409);
        if (input.action === "disconnect-preview") {
          console.info("[tiktok-qr] disconnect_preview", { profileId: saved.id, assignedCount: assigned.length });
          return reply({ profile: saved, linked: present, assignedCount: assigned.length, ticket: createDisconnectTicket({ userId: session.id, clienteId: cliente.id, profileId: saved.id, bcId: saved.bcId, assetId: saved.assetId, profileRevision: saved.revision ?? saved.createdAt, assignedIds: assigned }) });
        }
        if (input.confirm !== true) return reply({ error: "Confirma la desvinculación antes de continuar." }, 400);
        const confirmed = readDisconnectTicket(String(input.ticket ?? ""), session.id, cliente.id, saved.id);
        if (confirmed.bcId !== saved.bcId || confirmed.assetId !== saved.assetId || confirmed.profileRevision !== (saved.revision ?? saved.createdAt)) return reply({ error: "El perfil cambió desde la confirmación. Vuelve a elegir Desvincular perfil." }, 409);
        if (present && (assigned.length !== confirmed.assignedIds.length || assigned.some((id) => !confirmed.assignedIds.includes(id)))) return reply({ error: "Las cuentas vinculadas cambiaron. Revisa de nuevo la desvinculación antes de confirmar." }, 409);
        if (present) {
          await bcCall(REMOVE_PROFILE_PATH, saved.bcId, { asset_type: "TT_ACCOUNT", asset_ids: [saved.assetId] }, "POST");
          if ((await listBcTikTokAssets(saved.bcId)).some((asset) => String(asset.asset_id) === saved.assetId)) return reply({ error: "TikTok todavía muestra el perfil vinculado. Espera unos segundos y vuelve a intentarlo; conservamos el registro hasta confirmar la desvinculación." }, 409);
        }
        await markTikTokProfileDisconnected(cliente.id, saved.id);
        console.info("[tiktok-qr] profile_disconnected", { profileId: saved.id, providerWasPresent: present });
        return reply({ state: "disconnected", profileId: saved.id });
      }
      if (!present || saved.disconnectedAt) return reply({ error: "TikTok ya no confirma el acceso a este perfil. Vuelve a vincularlo con QR." }, 409);
      if (input.action === "unassign") {
        if (input.confirm !== true || ids.length !== 1) return reply({ error: "Selecciona y confirma la cuenta ads que quieres desvincular." }, 400);
        if (assigned.includes(ids[0])) await bcCall(UNASSIGN_PATH, saved.bcId, { asset_type: "TT_ACCOUNT", asset_id: saved.assetId, advertiser_id: ids[0] }, "POST");
        const remaining = await assignedAdvertisers(saved.bcId, saved.assetId);
        if (remaining.includes(ids[0])) return reply({ error: "TikTok todavía no confirma la desvinculación de esta cuenta. Espera y reintenta." }, 409);
        return reply({ state: "unassigned", advertiserId: ids[0] });
      }
      if (!ids.length) return reply({ error: "Elige al menos una cuenta ads para añadirla al perfil." }, 400);
      return reply({ state: "completed", profile: saved, results: await assignAccounts(saved.bcId, saved.assetId, ids) });
    }
    if (input.action === "start") {
      const bcIds = new Set(chosen.map((account) => account.bcId));
      if (bcIds.size > 1) return reply({ error: "Estas cuentas requieren autorizaciones diferentes. Elige un grupo de cuentas y repite el proceso aquí para las demás." }, 400);
      const profileName = String(input.profileName ?? "").trim();
      if (!profileName || profileName.length > 64) return reply({ error: "Ingresa el nombre visible de tu perfil de TikTok (hasta 64 caracteres)." }, 400);
      const reconnect = input.reconnectProfileId ? await getSavedTikTokProfile(cliente.id, String(input.reconnectProfileId)) : null;
      if (reconnect && chosen.some((account) => account.bcId !== reconnect.bcId)) return reply({ error: "Elige cuentas del mismo centro que el perfil que vas a volver a autorizar." }, 400);
      const bcId = reconnect?.bcId ?? chosen[0]?.bcId ?? HECOM_BM_BUCKET_TO_BC[resolveTikTokCreateBmForCliente(cliente.id)];
      if (!bcId) throw new Error("La conexión de TikTok de este cliente necesita una revisión de Holistic. Contacta a soporte.");
      const profiles = await listSavedTikTokProfiles(cliente.id);
      const started = await startQrSession({ userId: session.id, clienteId: cliente.id, bcId, advertiserIds: ids, profileName,
        ownedAssetIds: profiles.filter((p) => p.bcId === bcId).map((p) => p.assetId) });
      return reply({ ticket: started.ticket, expiresAt: started.expiresAt, qrDataUrl: await QRCode.toDataURL(started.authorizationUrl, { width: 320, margin: 3, errorCorrectionLevel: "M" }) });
    }
    if (input.action !== "status" && input.action !== "link") return reply({ error: "Operación no válida." }, 400);
    const qr = readQrSession(String(input.ticket ?? ""), session.id, cliente.id);
    if (!qr.advertiserIds.every((id) => accounts.some((a) => a.id === id && a.bcId === qr.bcId))) return reply({ error: "Cambió el acceso a tus cuentas. Genera un nuevo QR." }, 403);
    const profile = await findAuthorizedProfile(qr);
    if (!profile) return reply({ state: "waiting", message: "Escanea el QR y acepta los permisos en TikTok. Si ya aceptaste, comprueba el nombre visible del perfil. Soporte puede revisar la conexión si continúa sin aparecer." });
    if (input.action === "status") return reply({ state: "authorized", profile });
    const saved = await saveTikTokProfile({ clienteId: cliente.id, userId: session.id, bcId: qr.bcId, ...profile });
    const results = await assignAccounts(qr.bcId, profile.assetId, qr.advertiserIds);
    console.info("[tiktok-qr] profile_saved", { profileId: saved.id, requestedAdvertisers: qr.advertiserIds.length, linkedAdvertisers: results.filter((result) => result.ok).length });
    return reply({ state: "completed", profile: saved, results });
  } catch (error) {
    const failure = qrError(error);
    console.warn("[tiktok-qr] request_failed", { action, code: failure.code, endpoint: failure.endpoint, providerCode: failure.providerCode, requestId: failure.requestId });
    return reply(failure, 400);
  }
}

async function assignAccounts(bcId: string, assetId: string, ids: string[]) {
    if (!ids.length) return [];
    const linked = await assignedAdvertisers(bcId, assetId);
    const results: Array<{ advertiserId: string; ok: boolean; error?: ReturnType<typeof qrError> | { error: string } }> = [];
    for (const advertiserId of ids) {
      try {
        if (!linked.includes(advertiserId)) await bcCall(ASSIGN_PATH, bcId, { asset_type: "TT_ACCOUNT", asset_id: assetId, advertiser_id: advertiserId }, "POST");
        results.push({ advertiserId, ok: true });
      } catch (error) { results.push({ advertiserId, ok: false, error: qrError(error) }); }
    }
    const verified = await assignedAdvertisers(bcId, assetId);
    return results.map((result) => result.ok && !verified.includes(result.advertiserId)
      ? { ...result, ok: false, error: { error: "TikTok todavía no confirma esta vinculación. Espera unos segundos y reintenta las cuentas pendientes." } }
      : result);
}
