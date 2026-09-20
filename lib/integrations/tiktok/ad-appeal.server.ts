import "server-only";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { serverEnv } from "@/lib/env/env.server";

type TikTokApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
};

/**
 * Apela un anuncio Smart+ rechazado.
 * POST /open_api/v1.3/smart_plus/ad/appeal/
 * En Ads Manager: Rechazo → Apelar (mismo endpoint).
 */
export async function appealSmartPlusAd(input: {
  organizationId?: string;
  advertiserId: string;
  smartPlusAdId: string;
  appealReason: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const advertiserId = input.advertiserId.trim();
  const smartPlusAdId = input.smartPlusAdId.trim();
  const appealReason = input.appealReason.replace(/\s+/g, " ").trim().slice(0, 512);
  if (!advertiserId || !smartPlusAdId) {
    return { ok: false, message: "Falta el anuncio o la cuenta." };
  }
  if (appealReason.length < 12) {
    return { ok: false, message: "Escribí un motivo de apelación más claro." };
  }

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/smart_plus/ad/appeal/`, {
    method: "POST",
    headers: {
      "Access-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      smart_plus_ad_id: smartPlusAdId,
      appeal_reason: appealReason,
    }),
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<unknown>;
  if (json.code !== undefined && json.code !== 0) {
    return {
      ok: false,
      message: json.message ?? `TikTok rechazó la apelación (code=${json.code}).`,
    };
  }
  return { ok: true };
}
