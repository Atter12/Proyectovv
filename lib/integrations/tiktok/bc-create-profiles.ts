import { HECOM_BM_BUCKET_TO_BC } from "@/lib/hecom/bm-bucket.shared";

export type TikTokCreateBmBucket = "300" | "200" | "30" | "10";

export type TikTokBcCreateProfile = {
  bmBucket: TikTokCreateBmBucket;
  bcId: string;
  /** AGENCY usa qualification_id; DIRECT (BM10) lo omite. */
  bcType: "AGENCY" | "DIRECT";
  company: string;
  /** Null en DIRECT — no mandar `qualification_info`. */
  qualificationId: string | null;
  industry: number;
  registeredArea: string;
  timezone: string;
  currency: string;
  /**
   * Convención ops: el serial del nombre arranca en el tier del BM y sube 1 por
   * cada cuenta que el cliente ya tiene en ese BM.
   * Ej. BM300 → `Abel 300.0 USD - Agencia`, `Abel 301.0 USD - Agencia`, …
   * BM10 → `Jesus 10.0…`, `11.0…`, `12.0…`, `13.0…`
   */
  nameSerialBase: number;
  fundingMode: "cash_transfer" | "shared_budget";
};

/** Cola fija del nombre, después del serial. */
const NAME_TAIL = "USD - Agencia";

/** Perfiles Agency/DIRECT para create. BM 300 = default producto. */
export const TIKTOK_BC_CREATE_PROFILES: Record<
  TikTokCreateBmBucket,
  TikTokBcCreateProfile
> = {
  "300": {
    bmBucket: "300",
    bcId: HECOM_BM_BUCKET_TO_BC["300"]!,
    bcType: "AGENCY",
    company: "DISTRIBUCIONES EL CENTRO S.A.C.",
    qualificationId: "7683165994143449109",
    industry: 291406,
    registeredArea: "PE",
    timezone: "America/Lima",
    currency: "USD",
    nameSerialBase: 300,
    fundingMode: "cash_transfer",
  },
  "200": {
    bmBucket: "200",
    bcId: HECOM_BM_BUCKET_TO_BC["200"]!,
    bcType: "AGENCY",
    company: "PROALBA GROUP EIRL",
    qualificationId: "7577449402876198929",
    industry: 291406,
    registeredArea: "PE",
    timezone: "America/Lima",
    currency: "USD",
    nameSerialBase: 200,
    fundingMode: "cash_transfer",
  },
  "30": {
    bmBucket: "30",
    bcId: HECOM_BM_BUCKET_TO_BC["30"]!,
    bcType: "AGENCY",
    company: "HOLISTIC BUSINESS S.A.C.",
    qualificationId: "7566334805429485569",
    industry: 291406,
    registeredArea: "PE",
    timezone: "America/Lima",
    currency: "USD",
    nameSerialBase: 30,
    fundingMode: "shared_budget",
  },
  /** DIRECT · PANAMERICANA · sin qualification_info (estudio 2026-09-11). */
  "10": {
    bmBucket: "10",
    bcId: HECOM_BM_BUCKET_TO_BC["10"]!,
    bcType: "DIRECT",
    company: "PANAMERICANA OUTSOURCING S A SUCURSAL MEDELLIN",
    qualificationId: null,
    industry: 291406,
    registeredArea: "CO",
    timezone: "America/Bogota",
    currency: "USD",
    nameSerialBase: 10,
    fundingMode: "shared_budget",
  },
};

/** BM por defecto al crear desde Cuentas ads. */
export const DEFAULT_TIKTOK_CREATE_BM: TikTokCreateBmBucket = "300";

/** Máximo de cuentas TikTok self-serve por cliente Hecom. */
export const TIKTOK_SELF_SERVE_ACCOUNT_LIMIT = 2;

/**
 * Clientes con cupo ampliado, por pedido de gerencia.
 *
 * El cupo de 2 es la regla; esto son excepciones puntuales. Se resuelve en el
 * server y viaja a la UI como prop, así que el modal muestra el cupo real.
 *
 * `TIKTOK_SELF_SERVE_ACCOUNT_LIMIT_OVERRIDES` permite sumar casos sin deploy,
 * con formato `clienteId:limite,clienteId:limite`.
 */
const SELF_SERVE_LIMIT_OVERRIDES: Record<string, number> = {
  // Jesus Fuentes — 2026-09-16, autorizado por gerencia: 2 cuentas más.
  "529cdfbf-8b74-44a6-afec-5212b6687a6e": 4,
  // Jesús Callupe — 2026-09-23: ya tiene 5 mapeadas; +2 → cupo 7.
  // BM300 mientras BM10 sigue sin cupo TikTok (max advertisers).
  "6425e2d9-bb9b-4176-a126-ae889c1c8543": 7,
  // Abel Mogollon — 2026-09-23: ya tiene 6 mapeadas; +3 → cupo 9 (BM300).
  "673ac838-ce18-4074-a7a7-63407c72c80a": 9,
};

/**
 * Forzar BM de create self-serve por cliente (ops).
 * Callupe → BM300 por ahora (BM10 sin cupo BC).
 * Abel → BM300 (pedido ops; 200/300 ok).
 */
const SELF_SERVE_CREATE_BM_OVERRIDES: Record<string, TikTokCreateBmBucket> = {
  "6425e2d9-bb9b-4176-a126-ae889c1c8543": "300",
  "673ac838-ce18-4074-a7a7-63407c72c80a": "300",
};

function parseLimitOverridesEnv(): Record<string, number> {
  const raw = process.env.TIKTOK_SELF_SERVE_ACCOUNT_LIMIT_OVERRIDES;
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const pair of raw.split(",")) {
    const [id, limit] = pair.split(":").map((part) => part.trim());
    const parsed = Number(limit);
    if (id && Number.isInteger(parsed) && parsed > 0) out[id] = parsed;
  }
  return out;
}

export function resolveTikTokSelfServeAccountLimit(
  hecomClienteId: string | null | undefined,
): number {
  const id = String(hecomClienteId ?? "").trim();
  if (!id) return TIKTOK_SELF_SERVE_ACCOUNT_LIMIT;
  const override =
    parseLimitOverridesEnv()[id] ?? SELF_SERVE_LIMIT_OVERRIDES[id];
  return override && override > TIKTOK_SELF_SERVE_ACCOUNT_LIMIT
    ? override
    : TIKTOK_SELF_SERVE_ACCOUNT_LIMIT;
}

/** BM efectivo al crear cuenta (override por cliente o default producto). */
export function resolveTikTokCreateBmForCliente(
  hecomClienteId: string | null | undefined,
  requestedBm?: string | null,
): TikTokCreateBmBucket {
  const id = String(hecomClienteId ?? "").trim();
  if (id && SELF_SERVE_CREATE_BM_OVERRIDES[id]) {
    return SELF_SERVE_CREATE_BM_OVERRIDES[id]!;
  }
  const raw = String(requestedBm ?? DEFAULT_TIKTOK_CREATE_BM).trim();
  if (raw === "10" || raw === "30" || raw === "200" || raw === "300") {
    return raw;
  }
  return DEFAULT_TIKTOK_CREATE_BM;
}

/**
 * Self-serve create en mantenimiento (TikTok BC bloqueado / ops).
 * `true` = UI amable + API rechaza altas.
 *
 * 2026-09-15: TikTok levantó el bloqueo de riesgo del BM300 (el `40002 unusual
 * activity` del 12/09 ya no aparece; create real OK). Reactivado.
 */
export const TIKTOK_SELF_SERVE_CREATE_MAINTENANCE = false;

/** WhatsApp Holistic si el cliente pide más de 2. */
export const HOLISTIC_WHATSAPP_E164 = "51933484150";

export function buildHolisticWhatsAppUrl(prefill: string): string {
  return `https://wa.me/${HOLISTIC_WHATSAPP_E164}?text=${encodeURIComponent(prefill)}`;
}

export function getTikTokBcCreateProfile(
  bmBucket: string | null | undefined,
): TikTokBcCreateProfile {
  const key = String(bmBucket ?? DEFAULT_TIKTOK_CREATE_BM).trim();
  if (key === "200" || key === "30" || key === "300" || key === "10") {
    return TIKTOK_BC_CREATE_PROFILES[key];
  }
  return TIKTOK_BC_CREATE_PROFILES[DEFAULT_TIKTOK_CREATE_BM];
}

/**
 * Nombre estilo ops, con serial correlativo: `{Cliente} 300.0 USD - Agencia`,
 * `{Cliente} 301.0 USD - Agencia`, …
 */
export function buildTikTokAdvertiserName(input: {
  clienteName: string;
  bmBucket: string;
  /** Cuentas que el cliente ya tiene en ESE BM. 0 = primera → serial base. */
  existingInBm?: number;
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
  const offset = Math.max(0, Math.trunc(input.existingInBm ?? 0));
  const serial = profile.nameSerialBase + offset;
  const name = `${base} ${serial}.0 ${NAME_TAIL}`.replace(/\s+/g, " ").trim();
  return name.slice(0, 100);
}
