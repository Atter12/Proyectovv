/**
 * Arma los pedidos para crear una campaña Smart+ de ventas web (el "Upgraded
 * Smart+" de TikTok) sin dependencias, para tests. El molde copia cómo están
 * armadas las campañas Smart+ que más gastan en las cuentas de los clientes
 * (leídas con /smart_plus/*\/get/ el 22/10/2026):
 *
 *   campaña  WEB_CONVERSIONS → WEBSITE, presupuesto diario en la campaña
 *   grupo    CONVERT + SHOPPING (compras del píxel), puja automática,
 *            ubicaciones y segmentación automáticas, clic 7 días / vista 1 día
 *   anuncio  videos + textos + link con UTM + identidad de TikTok
 *
 * Todo se crea pausado: una persona lo revisa y lo prende.
 */

/** Ids de país de TikTok (GeoNames), los que usan los clientes hoy. */
export const COUNTRY_LOCATION_IDS = {
  PE: "3932488",
  CO: "3686110",
  MX: "3996063",
  EC: "3658394",
  CL: "3895114",
  BO: "3923057",
  DO: "3508796",
} as const;
export type CampaignCountry = keyof typeof COUNTRY_LOCATION_IDS;

/** Evento del píxel por el que optimiza TikTok. SHOPPING = compra. */
export type OptimizationEvent = "SHOPPING" | "ON_WEB_ORDER" | "INITIATE_ORDER" | "ON_WEB_CART";

export type CampaignGender = "GENDER_UNLIMITED" | "GENDER_MALE" | "GENDER_FEMALE";
export type CampaignAgeGroup = "AGE_18_24" | "AGE_25_34" | "AGE_35_44" | "AGE_45_54" | "AGE_55_100";

export type SmartPlusIdentity = {
  type: "TT_USER" | "CUSTOMIZED_USER" | "BC_AUTH_TT";
  id: string;
  /** Solo para BC_AUTH_TT. */
  bcId?: string | null;
};

export type SmartPlusPlanInput = {
  advertiserId: string;
  campaignName: string;
  /** Presupuesto diario en la moneda de la cuenta. */
  dailyBudget: number;
  country: CampaignCountry;
  pixelId: string;
  optimizationEvent?: OptimizationEvent;
  gender?: CampaignGender;
  /** Vacío = todas las edades (lo que mejor rinde con segmentación automática). */
  ageGroups?: CampaignAgeGroup[];
  videoIds: string[];
  /** Portada de cada video (web_uri de la imagen subida); TikTok la exige. */
  videoCovers?: Record<string, string>;
  adTexts: string[];
  landingPageUrl: string;
  identity: SmartPlusIdentity;
  /**
   * Paquete de botones (portafolio CTA de TikTok). Smart+ de ventas web no
   * acepta un botón suelto: rota los del paquete y se queda con el que vende.
   */
  callToActionId?: string;
  /** Inicio (UTC, "YYYY-MM-DD HH:MM:SS"); por defecto, ahora. */
  startTime?: string;
};

export type SmartPlusPlanError =
  | "noAdvertiser"
  | "noName"
  | "lowBudget"
  | "noPixel"
  | "noVideos"
  | "tooManyVideos"
  | "noText"
  | "badUrl"
  | "noIdentity";

/** Mínimo diario de TikTok para Smart+ (en USD; con otras monedas lo valida TikTok). */
export const MIN_DAILY_BUDGET = 20;
export const MAX_VIDEOS = 30;
export const MAX_TEXTS = 5;
const MAX_TEXT_LENGTH = 100;

export function validateSmartPlusPlan(input: SmartPlusPlanInput): SmartPlusPlanError[] {
  const errors: SmartPlusPlanError[] = [];
  if (!input.advertiserId.trim()) errors.push("noAdvertiser");
  if (!input.campaignName.trim()) errors.push("noName");
  if (!(input.dailyBudget >= MIN_DAILY_BUDGET)) errors.push("lowBudget");
  if (!input.pixelId.trim()) errors.push("noPixel");
  const videos = uniqueClean(input.videoIds);
  if (videos.length === 0) errors.push("noVideos");
  if (videos.length > MAX_VIDEOS) errors.push("tooManyVideos");
  if (uniqueClean(input.adTexts).length === 0) errors.push("noText");
  if (!isHttpUrl(input.landingPageUrl)) errors.push("badUrl");
  if (!input.identity.id.trim() || (input.identity.type === "BC_AUTH_TT" && !input.identity.bcId?.trim())) {
    errors.push("noIdentity");
  }
  return errors;
}

function uniqueClean(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Agrega los UTM de TikTok al link (sin pisar los que ya tenga). */
export function withTikTokUtm(url: string): string {
  const parsed = new URL(url.trim());
  const utm: Record<string, string> = {
    utm_source: "tiktok",
    utm_medium: "paid",
    utm_id: "__CAMPAIGN_ID__",
    utm_campaign: "__CAMPAIGN_NAME__",
  };
  for (const [key, value] of Object.entries(utm)) {
    if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
  }
  // TikTok reemplaza __CAMPAIGN_ID__: no debe quedar codificado.
  return parsed.toString().replace(/%5F%5F/gi, "__");
}

/** "2026-10-22 18:05:00" en UTC, como lo pide TikTok. */
export function tiktokUtcTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export type SmartPlusPlan = {
  campaign: Record<string, unknown>;
  /** Falta campaign_id: se completa con lo que devuelve la campaña. */
  adgroup: Record<string, unknown>;
  /** Falta adgroup_id: se completa con lo que devuelve el grupo. */
  ad: Record<string, unknown>;
};

/**
 * Pedidos listos para /smart_plus/campaign|adgroup|ad/create/. `requestId`
 * evita duplicados si se reintenta (TikTok lo pide en campaña y grupo).
 */
/**
 * Botones del paquete, en español, con los ids fijos de TikTok (los mismos en
 * todas las cuentas; leídos de las campañas de los clientes).
 */
export const DEFAULT_CTA_PORTFOLIO = [
  { asset_content: "Comprar ahora", asset_ids: ["201885", "201387"] },
  { asset_content: "Realizar pedido ahora", asset_ids: ["202046", "201641"] },
  { asset_content: "Más información", asset_ids: ["201781", "201535"] },
];

export function buildSmartPlusPlan(input: SmartPlusPlanInput, opts: { requestId: string; now: Date }): SmartPlusPlan {
  const name = input.campaignName.trim().slice(0, 100);
  const budget = Math.round(input.dailyBudget * 100) / 100;
  const identity = {
    identity_type: input.identity.type,
    identity_id: input.identity.id.trim(),
    ...(input.identity.type === "BC_AUTH_TT" && input.identity.bcId
      ? { identity_authorized_bc_id: input.identity.bcId.trim() }
      : {}),
  };

  const campaign = {
    advertiser_id: input.advertiserId,
    request_id: `${opts.requestId}1`,
    campaign_name: name,
    objective_type: "WEB_CONVERSIONS",
    sales_destination: "WEBSITE",
    campaign_type: "REGULAR_CAMPAIGN",
    budget_optimize_on: true,
    budget_mode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
    budget,
    operation_status: "DISABLE",
  };

  const ageGroups = [...new Set(input.ageGroups ?? [])];
  const adgroup = {
    advertiser_id: input.advertiserId,
    request_id: `${opts.requestId}2`,
    adgroup_name: `${name} · grupo`.slice(0, 100),
    promotion_type: "WEBSITE",
    optimization_goal: "CONVERT",
    optimization_event: input.optimizationEvent ?? "SHOPPING",
    pixel_id: input.pixelId.trim(),
    billing_event: "OCPM",
    bid_type: "BID_TYPE_NO_BID",
    placement_type: "PLACEMENT_TYPE_AUTOMATIC",
    schedule_type: "SCHEDULE_FROM_NOW",
    schedule_start_time: input.startTime ?? tiktokUtcTime(opts.now),
    targeting_optimization_mode: "AUTOMATIC",
    targeting_spec: {
      location_ids: [COUNTRY_LOCATION_IDS[input.country]],
      gender: input.gender ?? "GENDER_UNLIMITED",
      ...(ageGroups.length > 0 ? { age_groups: ageGroups } : {}),
    },
    click_attribution_window: "SEVEN_DAYS",
    view_attribution_window: "ONE_DAY",
    attribution_event_count: "EVERY",
    // Comentarios apagados: en ventas se llenan de reclamos y bajan la conversión.
    comment_disabled: true,
    video_download_disabled: true,
    operation_status: "ENABLE",
  };

  const ad = {
    advertiser_id: input.advertiserId,
    ad_name: `${name} · anuncio`.slice(0, 100),
    creative_list: uniqueClean(input.videoIds).map((videoId) => {
      const cover = input.videoCovers?.[videoId];
      return {
        creative_info: {
          ad_format: "SINGLE_VIDEO",
          video_info: { video_id: videoId },
          ...(cover ? { image_info: [{ web_uri: cover }] } : {}),
          ...identity,
        },
      };
    }),
    ad_text_list: uniqueClean(input.adTexts)
      .slice(0, MAX_TEXTS)
      .map((text) => ({ ad_text: text.slice(0, MAX_TEXT_LENGTH) })),
    landing_page_url_list: [{ landing_page_url: withTikTokUtm(input.landingPageUrl) }],
    ad_configuration: {
      ...identity,
      ...(input.callToActionId ? { call_to_action_id: input.callToActionId } : {}),
    },
    operation_status: "ENABLE",
  };

  return { campaign, adgroup, ad };
}

export type AddVideosError = "noVideos" | "nothingNew" | "tooManyVideos" | "noCover" | "noIdentity";

/** Tope de videos por anuncio Smart+ (TikTok acepta hasta 50). */
export const MAX_AD_VIDEOS = 50;

/**
 * Pedido para /smart_plus/ad/update/ que suma videos a un anuncio que ya
 * corre. TikTok reemplaza la lista entera, así que van todos los videos
 * actuales (con su ad_material_id, también los pausados, para no perder sus
 * datos) más los nuevos con el mismo perfil que publica. Textos, links y
 * botones se reenvían tal cual.
 */
export function buildAddVideosUpdate(
  ad: Record<string, unknown>,
  videos: { videoId: string; coverUri: string | null }[],
): { ok: true; body: Record<string, unknown>; added: string[] } | { ok: false; error: AddVideosError } {
  const current = ((ad.creative_list as Record<string, unknown>[] | undefined) ?? []).filter((c) => c.creative_info);
  const inAd = new Set(
    current.map((c) => String(((c.creative_info as Record<string, unknown>).video_info as Record<string, unknown> | undefined)?.video_id ?? "")),
  );
  const wanted = [...new Map(videos.map((v) => [v.videoId.trim(), v])).values()].filter((v) => v.videoId.trim());
  if (wanted.length === 0) return { ok: false, error: "noVideos" };
  const fresh = wanted.filter((v) => !inAd.has(v.videoId.trim()));
  if (fresh.length === 0) return { ok: false, error: "nothingNew" };
  if (current.length + fresh.length > MAX_AD_VIDEOS) return { ok: false, error: "tooManyVideos" };
  if (fresh.some((v) => !v.coverUri)) return { ok: false, error: "noCover" };

  const source = (current[0]?.creative_info ?? ad.ad_configuration ?? {}) as Record<string, unknown>;
  if (!source.identity_id || !source.identity_type) return { ok: false, error: "noIdentity" };
  const identity = {
    identity_type: source.identity_type,
    identity_id: source.identity_id,
    ...(source.identity_authorized_bc_id ? { identity_authorized_bc_id: source.identity_authorized_bc_id } : {}),
  };

  const creative_list = [
    ...current.map((c) => ({
      ...(c.ad_material_id ? { ad_material_id: String(c.ad_material_id) } : {}),
      creative_info: c.creative_info,
    })),
    ...fresh.map((v) => ({
      creative_info: {
        ad_format: "SINGLE_VIDEO",
        video_info: { video_id: v.videoId.trim() },
        image_info: [{ web_uri: v.coverUri }],
        ...identity,
      },
    })),
  ];
  const body: Record<string, unknown> = {
    advertiser_id: String(ad.advertiser_id ?? ""),
    smart_plus_ad_id: String(ad.smart_plus_ad_id ?? ""),
    creative_list,
  };
  for (const key of ["ad_name", "ad_text_list", "landing_page_url_list", "ad_configuration"]) {
    if (ad[key] !== undefined) body[key] = ad[key];
  }
  return { ok: true, body, added: fresh.map((v) => v.videoId.trim()) };
}
