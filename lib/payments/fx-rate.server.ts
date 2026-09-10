import "server-only";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Tipo de cambio USD→PEN para cobros en soles (BCP manual + Yape/Cobrana).
 *
 * Fuente preferida: serie BCRP "TC Sistema bancario SBS (S/ por US$) - Venta"
 * (PD04640PD) — republish oficial del promedio SBS venta.
 *
 * Cuidados:
 * - No depende de APIs de terceros de pago.
 * - Valida rango vs fallback env (± tolerancia).
 * - Cache en memoria; si falla o es raro → HOLISTIC_USD_PEN_RATE.
 * - El TC se congela en el intent (`fx_rate_usd_pen`); no recalcular a mitad de pago.
 */

export type FxRateSource = "sbs" | "env";

export type HolisticFxQuote = {
  usdPen: number;
  source: FxRateSource;
  asOf: string | null;
  sellRaw: number | null;
  spreadApplied: number;
  cached: boolean;
};

type CacheEntry = {
  quote: HolisticFxQuote;
  fetchedAtMs: number;
};

const BCRP_SERIES_SBS_SELL = "PD04640PD";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FETCH_TIMEOUT_MS = 8_000;

let memoryCache: CacheEntry | null = null;
let inFlight: Promise<HolisticFxQuote> | null = null;

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function envFallbackRate(): number {
  const raw = serverEnv.holisticUsdPenRate;
  if (!Number.isFinite(raw) || raw <= 0) return 3.48;
  return round4(raw);
}

function absoluteBounds(): { min: number; max: number } {
  return {
    min: serverEnv.holisticUsdPenMin,
    max: serverEnv.holisticUsdPenMax,
  };
}

function relativeOk(rate: number, fallback: number): boolean {
  const tol = serverEnv.holisticUsdPenTolerancePct;
  if (!(tol > 0 && tol < 1)) return true;
  const lo = fallback * (1 - tol);
  const hi = fallback * (1 + tol);
  return rate >= lo && rate <= hi;
}

function withinAbsolute(rate: number): boolean {
  const { min, max } = absoluteBounds();
  return rate >= min && rate <= max;
}

function applySpread(sell: number): number {
  const spread = serverEnv.holisticUsdPenSpread;
  if (!Number.isFinite(spread) || spread === 0) return round4(sell);
  return round4(sell + spread);
}

function envQuote(): HolisticFxQuote {
  const usdPen = applySpread(envFallbackRate());
  return {
    usdPen: round4(usdPen),
    source: "env",
    asOf: null,
    sellRaw: null,
    spreadApplied: serverEnv.holisticUsdPenSpread || 0,
    cached: false,
  };
}

/** Parse BCRP period names like "04.Set.26" / "25.Ago.26". */
function parseBcrpPeriodName(name: string): string | null {
  const m = String(name)
    .trim()
    .match(/^(\d{1,2})\.([A-Za-zÁÉÍÓÚáéíóú]{3})\.(\d{2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const monRaw = m[2]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .slice(0, 3);
  const yy = Number(m[3]);
  const months: Record<string, number> = {
    ene: 1,
    feb: 2,
    mar: 3,
    abr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    set: 9,
    sep: 9,
    oct: 10,
    nov: 11,
    dic: 12,
  };
  const month = months[monRaw];
  if (!month || !Number.isFinite(day) || !Number.isFinite(yy)) return null;
  const year = 2000 + yy;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${iso}T12:00:00Z`))) return null;
  return iso;
}

function parseSellValue(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(",", ".");
  if (!s || /^n\.?d\.?$/i.test(s)) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function fetchSbsSellFromBcrp(): Promise<{
  sell: number;
  asOf: string;
} | null> {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 21);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const url = `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/${BCRP_SERIES_SBS_SELL}/json/${fromStr}/${toStr}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AdsHolisticFX/1.0 (+https://www.adsholistic.com)",
      },
      // Server-side; avoid Next Data Cache surprises for money rates.
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[fx-rate] BCRP HTTP", res.status);
      return null;
    }
    const text = await res.text();
    if (!text || text.trimStart().startsWith("<")) {
      console.warn("[fx-rate] BCRP respondió HTML/no-JSON");
      return null;
    }
    let body: {
      periods?: Array<{ name?: string; values?: unknown[] }>;
    };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      console.warn("[fx-rate] BCRP JSON inválido");
      return null;
    }
    const periods = Array.isArray(body.periods) ? body.periods : [];
    for (let i = periods.length - 1; i >= 0; i -= 1) {
      const p = periods[i];
      const sell = parseSellValue(p?.values?.[0]);
      if (sell == null) continue;
      const asOf = parseBcrpPeriodName(String(p?.name ?? "")) ?? toStr;
      return { sell, asOf };
    }
    console.warn("[fx-rate] BCRP sin valores numéricos recientes");
    return null;
  } catch (e) {
    console.warn(
      "[fx-rate] BCRP fetch falló",
      e instanceof Error ? e.message : e,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function acceptOrReject(sell: number): boolean {
  const fallback = envFallbackRate();
  if (!withinAbsolute(sell)) {
    console.warn("[fx-rate] fuera de rango absoluto", { sell, ...absoluteBounds() });
    return false;
  }
  if (!relativeOk(sell, fallback)) {
    console.warn("[fx-rate] fuera de tolerancia vs env", {
      sell,
      fallback,
      tol: serverEnv.holisticUsdPenTolerancePct,
    });
    return false;
  }
  return true;
}

async function loadFreshQuote(): Promise<HolisticFxQuote> {
  if (serverEnv.fxRateSource === "manual") {
    return envQuote();
  }

  const remote = await fetchSbsSellFromBcrp();
  if (!remote || !acceptOrReject(remote.sell)) {
    return envQuote();
  }

  const withSpread = applySpread(remote.sell);
  if (!acceptOrReject(withSpread)) {
    return envQuote();
  }

  return {
    usdPen: round4(withSpread),
    source: "sbs",
    asOf: remote.asOf,
    sellRaw: round4(remote.sell),
    spreadApplied: serverEnv.holisticUsdPenSpread || 0,
    cached: false,
  };
}

/**
 * Resuelve TC con refresh controlado (cache 6h).
 * Usar al cotizar intents / config de pagos.
 */
export async function resolveHolisticUsdPenRate(): Promise<HolisticFxQuote> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.fetchedAtMs < CACHE_TTL_MS) {
    return { ...memoryCache.quote, cached: true };
  }

  if (!inFlight) {
    inFlight = (async () => {
      const quote = await loadFreshQuote();
      memoryCache = { quote, fetchedAtMs: Date.now() };
      return quote;
    })().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

/**
 * Sync: cache fresca o env. No hace red.
 * Prefiere `resolveHolisticUsdPenRate` al crear intents.
 */
export function getHolisticUsdPenRateSync(): number {
  if (
    memoryCache &&
    Date.now() - memoryCache.fetchedAtMs < CACHE_TTL_MS
  ) {
    return memoryCache.quote.usdPen;
  }
  return envQuote().usdPen;
}
