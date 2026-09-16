/**
 * Límites del checkout cripto (USDT TRC20 vía NOWPayments).
 *
 * NOWPayments rechaza pagos por debajo del mínimo de la red con
 * `amountTo is too small`. Medido contra la API de producción:
 *   - sin is_fixed_rate: pasa desde ~$12 (min-amount reporta 11.34 USDT)
 *   - con is_fixed_rate: recién pasa desde ~$19
 *
 * Client-safe: no importar serverEnv acá, lo usa el modal de recarga.
 */
export const CRYPTO_MIN_USD = 12;

export function isBelowCryptoMinimum(amountUsd: number): boolean {
  return Number.isFinite(amountUsd) && amountUsd < CRYPTO_MIN_USD;
}
