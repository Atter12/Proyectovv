/**
 * Freno y detección de límites de la API de TikTok (sin dependencias, para tests).
 *
 * TikTok limita por app y por endpoint (Basic: 10 por segundo, 600 por minuto).
 * Los procesos del Radar comparten token con otros seis procesos, así que se
 * frenan por debajo de ese tope.
 */

/** Códigos que TikTok usa cuando se excede un límite de consultas. */
export const TIKTOK_RATE_LIMIT_CODES: ReadonlySet<number> = new Set([40100, 40016, 40133]);

export function isTikTokRateLimited(
  code: number | null | undefined,
  message: string | null | undefined,
): boolean {
  if (code != null && TIKTOK_RATE_LIMIT_CODES.has(code)) return true;
  return /OVER_QPS|QPS LIMIT|TOO FREQUENT|RATE LIMIT/i.test(String(message ?? ""));
}

/**
 * Espera antes de reintentar una consulta frenada por TikTok. Solo cubre los
 * excesos por segundo; si sigue frenada, el proceso guarda su avance y termina
 * (pasarse del límite por minuto obliga a esperar 5 minutos).
 */
export function rateLimitBackoffMs(attempt: number): number | null {
  const schedule = [1500, 4000];
  return attempt >= 0 && attempt < schedule.length ? schedule[attempt]! : null;
}

export type RateLimiter = {
  /** Resuelve cuando la siguiente consulta puede salir. */
  acquire(): Promise<void>;
};

/**
 * Espaciado fijo entre consultas (1000 / qps ms). La reserva del turno es
 * sincrónica, así que funciona con varias consultas en paralelo.
 */
export function createRateLimiter(input: {
  qps: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): RateLimiter {
  const qps = Number.isFinite(input.qps) && input.qps > 0 ? input.qps : 5;
  const intervalMs = 1000 / qps;
  const now = input.now ?? (() => Date.now());
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let nextAt = 0;

  return {
    async acquire() {
      const current = now();
      const slot = Math.max(current, nextAt);
      nextAt = slot + intervalMs;
      const wait = slot - current;
      if (wait > 0) await sleep(wait);
    },
  };
}
