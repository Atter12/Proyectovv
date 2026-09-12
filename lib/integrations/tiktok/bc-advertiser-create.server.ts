import "server-only";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import {
  buildTikTokAdvertiserName,
  getTikTokBcCreateProfile,
  type TikTokCreateBmBucket,
} from "@/lib/integrations/tiktok/bc-create-profiles";

type TikTokApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export type CreateBcAdvertiserResult = {
  advertiserId: string;
  advertiserName: string;
  bcId: string;
  bmBucket: TikTokCreateBmBucket;
  tiktokRequestId: string | null;
};

function apiUrl(path: string): string {
  return `https://business-api.tiktok.com/open_api/v1.3${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Crea advertiser AUCTION bajo un BC Agency (BM 300/200/30).
 * @see POST /bc/advertiser/create/
 */
export async function createBcAdvertiserForCliente(input: {
  clienteName: string;
  bmBucket?: string | null;
  organizationId?: string;
  sequence?: number;
}): Promise<CreateBcAdvertiserResult> {
  const profile = getTikTokBcCreateProfile(input.bmBucket);
  const advertiserName = buildTikTokAdvertiserName({
    clienteName: input.clienteName,
    bmBucket: profile.bmBucket,
    sequence: input.sequence,
  });

  const { token: accessToken } = await resolveTikTokFinanceAccessToken(
    input.organizationId,
  );

  const body = {
    bc_id: profile.bcId,
    advertiser_info: {
      name: advertiserName,
      currency: profile.currency,
      timezone: profile.timezone,
      type: "AUCTION",
    },
    customer_info: {
      company: profile.company,
      industry: profile.industry,
      registered_area: profile.registeredArea,
    },
    qualification_info: {
      qualification_id: profile.qualificationId,
    },
  };

  console.info("[tiktok-bc] advertiser_create_attempt", {
    bcId: profile.bcId,
    bmBucket: profile.bmBucket,
    advertiserName,
  });

  const response = await fetch(apiUrl("/bc/advertiser/create/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json()) as TikTokApiResponse<{
    advertiser_id?: string | number;
    advertiserId?: string | number;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    const detail = json.message ?? `HTTP ${response.status}`;
    console.error("[tiktok-bc] advertiser_create_failed", {
      code: json.code ?? null,
      message: detail,
      bcId: profile.bcId,
      bmBucket: profile.bmBucket,
      tiktokRequestId: json.request_id ?? null,
    });
    if (/unusual activity/i.test(detail)) {
      // Cliente: técnico + acción Holistic (no “tu AM”).
      throw new Error(
        "TikTok_BC_UNUSUAL_ACTIVITY: TikTok rechazó el alta (API 40002 · unusual activity en el Business Center). No es un fallo de Holistic: el BC está en revisión de riesgo. Escribinos por WhatsApp para escalarlo. Tus cuentas actuales siguen operando.",
      );
    }
    if (/industry invalid/i.test(detail)) {
      throw new Error(
        "TikTok rechazó la industria del perfil (API). Contactá a Holistic por WhatsApp.",
      );
    }
    if (/maximum number of advertiser/i.test(detail)) {
      throw new Error(
        "Este Business Center llegó al tope de cuentas en TikTok (cuota BC). Contactá a Holistic por WhatsApp.",
      );
    }
    if (/qualification/i.test(detail)) {
      throw new Error(
        "La qualification del Business Center no está lista en TikTok. Contactá a Holistic por WhatsApp.",
      );
    }
    throw new Error(`No se pudo crear la cuenta en TikTok: ${detail}`);
  }

  const advertiserId = String(
    json.data?.advertiser_id ?? json.data?.advertiserId ?? "",
  ).trim();
  if (!advertiserId) {
    throw new Error(
      "TikTok creó la cuenta pero no devolvió advertiser_id. Contactá a soporte.",
    );
  }

  console.info("[tiktok-bc] advertiser_create_ok", {
    advertiserId,
    advertiserName,
    bcId: profile.bcId,
    bmBucket: profile.bmBucket,
    tiktokRequestId: json.request_id ?? null,
  });

  return {
    advertiserId,
    advertiserName,
    bcId: profile.bcId,
    bmBucket: profile.bmBucket,
    tiktokRequestId: json.request_id ?? null,
  };
}
