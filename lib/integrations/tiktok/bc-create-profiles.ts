import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";

export type TikTokCreateBmBucket = "300" | "200" | "30";

export type TikTokBcCreateProfile = {
  bmBucket: TikTokCreateBmBucket;
  bcId: string;
  company: string;
  qualificationId: string;
  industry: number;
  registeredArea: string;
  timezone: string;
  currency: string;
  nameSuffix: string;
  fundingMode: "cash_transfer" | "shared_budget";
};

/** Perfiles Agency para create. BM 300 = principal (producto). */
export const TIKTOK_BC_CREATE_PROFILES: Record<
  TikTokCreateBmBucket,
  TikTokBcCreateProfile
> = {
  "300": {
    bmBucket: "300",
    bcId: HECOM_BM_BUCKET_TO_BC["300"]!,
    company: "DISTRIBUCIONES EL CENTRO S.A.C.",
    qualificationId: "7683165994143449109",
    industry: 291406,
    registeredArea: "PE",
    timezone: "America/Lima",
    currency: "USD",
    nameSuffix: "300.0 USD - Agencia",
    fundingMode: "cash_transfer",
  },
  "200": {
    bmBucket: "200",
    bcId: HECOM_BM_BUCKET_TO_BC["200"]!,
    company: "PROALBA GROUP EIRL",
    qualificationId: "7577449402876198929",
    industry: 291406,
    registeredArea: "PE",
    timezone: "America/Lima",
    currency: "USD",
    nameSuffix: "200.0 USD - Agencia",
    fundingMode: "cash_transfer",
  },
  "30": {
    bmBucket: "30",
    bcId: HECOM_BM_BUCKET_TO_BC["30"]!,
    company: "HOLISTIC BUSINESS S.A.C.",
    qualificationId: "7566334805429485569",
    industry: 291406,
    registeredArea: "PE",
    timezone: "America/Lima",
    currency: "USD",
    nameSuffix: "30.0 USD - Agencia",
    fundingMode: "shared_budget",
  },
};

/** BM por defecto al crear desde Cuentas ads. */
export const DEFAULT_TIKTOK_CREATE_BM: TikTokCreateBmBucket = "300";

/** Máximo de cuentas TikTok self-serve por cliente Hecom. */
export const TIKTOK_SELF_SERVE_ACCOUNT_LIMIT = 2;

/**
 * Self-serve create en mantenimiento (TikTok BC bloqueado / ops).
 * `true` = UI amable + API rechaza altas. Volver a `false` cuando TikTok abra.
 */
export const TIKTOK_SELF_SERVE_CREATE_MAINTENANCE = true;

/** WhatsApp Holistic si el cliente pide más de 2. */
export const HOLISTIC_WHATSAPP_E164 = "51933484150";

export function buildHolisticWhatsAppUrl(prefill: string): string {
  return `https://wa.me/${HOLISTIC_WHATSAPP_E164}?text=${encodeURIComponent(prefill)}`;
}

export function getTikTokBcCreateProfile(
  bmBucket: string | null | undefined,
): TikTokBcCreateProfile {
  const key = String(bmBucket ?? DEFAULT_TIKTOK_CREATE_BM).trim();
  if (key === "200" || key === "30" || key === "300") {
    return TIKTOK_BC_CREATE_PROFILES[key];
  }
  return TIKTOK_BC_CREATE_PROFILES[DEFAULT_TIKTOK_CREATE_BM];
}

/** Nombre estilo ops: `{Cliente} 300.0 USD - Agencia`. */
export function buildTikTokAdvertiserName(input: {
  clienteName: string;
  bmBucket: string;
  /** Si ya existe el nombre base, agregar sufijo corto. */
  sequence?: number;
}): string {
  const profile = getTikTokBcCreateProfile(input.bmBucket);
  const tokens = String(input.clienteName ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  const base = tokens || "Cliente Holistic";
  const seq =
    input.sequence && input.sequence > 1 ? ` ${input.sequence}` : "";
  const name = `${base}${seq} ${profile.nameSuffix}`.replace(/\s+/g, " ").trim();
  return name.slice(0, 100);
}
