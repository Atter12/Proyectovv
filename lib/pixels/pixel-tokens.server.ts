import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";

/**
 * Access token de Events API hecho por Ads Holistic. TikTok solo lo genera desde
 * Events Manager (sin API) y el cliente no entra a nuestro BM: este token es de un
 * solo píxel y los eventos pasan por nuestro servidor, que los reenvía a TikTok con
 * el token de la agencia (nunca se le muestra al cliente).
 */
const TOKEN_PREFIX = "ahtk_";
export const PIXEL_TOKEN_MAX_EVENTS = 1000;

export type PixelTokenInfo = {
  pixelCode: string;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
  eventsSent: number;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function looksLikePixelToken(value: string): boolean {
  return /^ahtk_[a-f0-9]{48}$/.test(value);
}

export async function listActivePixelTokens(hecomClienteId: string): Promise<PixelTokenInfo[]> {
  const { data, error } = await createAdminClient()
    .from("tiktok_pixel_tokens")
    .select("pixel_code,token_hint,created_at,last_used_at,events_sent")
    .eq("hecom_cliente_id", hecomClienteId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    pixelCode: String(r.pixel_code),
    hint: String(r.token_hint),
    createdAt: String(r.created_at),
    lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    eventsSent: Number(r.events_sent) || 0,
  }));
}

/** Crea un token nuevo para el píxel y anula el anterior. Devuelve el token una sola vez. */
export async function createPixelToken(input: {
  hecomClienteId: string;
  pixelRowId: string;
  userId: string;
}): Promise<{ token: string; info: PixelTokenInfo }> {
  const admin = createAdminClient();
  const { data: pixel, error } = await admin
    .from("tiktok_pixels")
    .select("pixel_id,pixel_code")
    .eq("id", input.pixelRowId)
    .eq("hecom_cliente_id", input.hecomClienteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const pixelCode = String(pixel?.pixel_code ?? "").trim();
  if (!pixel || !pixelCode) throw new Error("Píxel no encontrado.");

  const now = new Date().toISOString();
  const { error: revokeErr } = await admin
    .from("tiktok_pixel_tokens")
    .update({ revoked_at: now })
    .eq("pixel_code", pixelCode)
    .is("revoked_at", null);
  if (revokeErr) throw new Error(revokeErr.message);

  const token = `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
  const hint = `${token.slice(0, 9)}…${token.slice(-4)}`;
  const { data: row, error: insErr } = await admin
    .from("tiktok_pixel_tokens")
    .insert({
      hecom_cliente_id: input.hecomClienteId,
      pixel_id: String(pixel.pixel_id),
      pixel_code: pixelCode,
      token_hash: hashToken(token),
      token_hint: hint,
      created_by: input.userId,
    })
    .select("created_at")
    .single();
  if (insErr || !row) throw new Error(insErr?.message ?? "No se pudo crear el token.");

  return {
    token,
    info: { pixelCode, hint, createdAt: String(row.created_at), lastUsedAt: null, eventsSent: 0 },
  };
}

export type ForwardResult = { status: number; body: Record<string, unknown> };

const fail = (status: number, code: number, message: string): ForwardResult => ({
  status,
  body: { code, message, data: {} },
});

/**
 * Recibe un pedido con el mismo formato del Events API 2.0 de TikTok
 * (`event_source`, `event_source_id`, `data[]`) y lo reenvía si el token es de ese píxel.
 */
export async function forwardPixelEvents(token: string, payload: unknown): Promise<ForwardResult> {
  if (!looksLikePixelToken(token)) return fail(401, 40105, "Access token inválido.");
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("tiktok_pixel_tokens")
    .select("id,pixel_code")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (!row) return fail(401, 40105, "Access token inválido o anulado.");

  const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const pixelCode = String(row.pixel_code);
  const sourceId = String(body.event_source_id ?? body.pixel_code ?? pixelCode).trim();
  if (sourceId !== pixelCode) {
    return fail(403, 40001, "Este access token no es de ese píxel.");
  }
  const events = Array.isArray(body.data) ? body.data : [];
  if (events.length === 0) return fail(400, 40002, "data vacío: manda al menos un evento.");
  if (events.length > PIXEL_TOKEN_MAX_EVENTS) {
    return fail(400, 40002, `Máximo ${PIXEL_TOKEN_MAX_EVENTS} eventos por pedido.`);
  }

  const { token: agencyToken } = await resolveTikTokFinanceAccessToken();
  if (!agencyToken?.trim()) return fail(503, 50000, "Servicio no disponible.");

  const forward: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixelCode,
    data: events,
  };
  if (typeof body.test_event_code === "string" && body.test_event_code.trim()) {
    forward.test_event_code = body.test_event_code.trim();
  }

  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/event/track/`, {
      method: "POST",
      headers: { "Access-Token": agencyToken.trim(), "Content-Type": "application/json" },
      body: JSON.stringify(forward),
      cache: "no-store",
    });
  } catch {
    return fail(502, 50001, "No se pudo contactar a TikTok. Reintenta.");
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json) return fail(502, 50001, "TikTok respondió algo inválido. Reintenta.");
  if (json.code === 0) {
    await admin.rpc("tiktok_pixel_token_used", { p_id: row.id, p_events: events.length });
  }
  return { status: res.ok ? 200 : res.status, body: json };
}
