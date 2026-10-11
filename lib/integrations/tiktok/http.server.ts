import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import {
  createRateLimiter,
  isTikTokRateLimited,
  rateLimitBackoffMs,
} from "@/lib/integrations/tiktok/rate-limit";

/**
 * Cliente HTTP de TikTok para el código del Radar.
 *
 * - Freno por proceso (`RADAR_TIKTOK_QPS`, por defecto 5/s) para dejar espacio
 *   a los otros procesos que usan el mismo token.
 * - Ante un límite de TikTok reintenta dos veces con espera corta; si sigue
 *   frenado lanza `TikTokRateLimitError` para que el proceso guarde su avance
 *   y termine (pasarse del límite por minuto obliga a esperar 5 minutos).
 *
 * El resto del repo tiene sus propios helpers; no se migran en esta etapa.
 */

export type TikTokEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export class TikTokApiError extends Error {
  readonly code: number | null;
  readonly requestId: string | null;
  readonly path: string;

  constructor(input: { message: string; code: number | null; requestId?: string | null; path: string }) {
    super(input.message);
    this.name = "TikTokApiError";
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.path = input.path;
  }
}

export class TikTokRateLimitError extends TikTokApiError {
  constructor(input: { message: string; code: number | null; requestId?: string | null; path: string }) {
    super(input);
    this.name = "TikTokRateLimitError";
  }
}

const limiter = createRateLimiter({ qps: serverEnv.radarTiktokQps });

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function buildUrl(path: string, query?: Record<string, unknown>): URL {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return url;
}

export async function tiktokRequest<T>(input: {
  path: string;
  accessToken: string;
  method?: "GET" | "POST";
  /** Arrays y objetos se envían como JSON (como pide TikTok). */
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const method = input.method ?? "GET";
  const url = buildUrl(input.path, input.query);
  let networkRetried = false;

  for (let attempt = 0; ; attempt += 1) {
    await limiter.acquire();

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          "Access-Token": input.accessToken,
          Accept: "application/json",
          ...(input.body ? { "Content-Type": "application/json" } : {}),
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
      });
    } catch (error) {
      if (!networkRetried) {
        networkRetried = true;
        await sleep(1000);
        continue;
      }
      throw new TikTokApiError({
        message: error instanceof Error ? error.message : "No se pudo conectar con TikTok.",
        code: null,
        path: input.path,
      });
    }

    const json = (await response.json().catch(() => ({}))) as TikTokEnvelope<T>;
    const code = typeof json.code === "number" ? json.code : response.ok ? 0 : response.status;

    if (code === 0 && response.ok) return (json.data ?? ({} as T)) as T;

    const details = {
      message: json.message || `TikTok ${input.path} falló (code=${code}).`,
      code,
      requestId: json.request_id ?? null,
      path: input.path,
    };

    if (isTikTokRateLimited(code, json.message) || response.status === 429) {
      const wait = rateLimitBackoffMs(attempt);
      if (wait == null) throw new TikTokRateLimitError(details);
      console.warn("[radar-tiktok] rate_limited_retry", { path: input.path, code, attempt, wait });
      await sleep(wait);
      continue;
    }

    throw new TikTokApiError(details);
  }
}
