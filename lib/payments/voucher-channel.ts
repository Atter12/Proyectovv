/**
 * Canal y banco de origen de un voucher, normalizados para mostrarlos igual
 * sin importar cómo los escriba el comprobante ("INTERBANK", "Banco
 * Internacional del Perú", "interbank app"…).
 */

export type VoucherChannel =
  | "yape"
  | "plin"
  | "transferencia"
  | "deposito"
  | "binance"
  | "cripto"
  | "tarjeta"
  | "otro";

const CHANNEL_ALIASES: Array<[RegExp, VoucherChannel]> = [
  [/yape/i, "yape"],
  [/plin/i, "plin"],
  [/binance/i, "binance"],
  [/usdt|cripto|crypto|bitcoin|btc|wallet/i, "cripto"],
  [/dep[oó]sito|agente|ventanilla/i, "deposito"],
  [/transfer|interbancari|cci|tran\.?/i, "transferencia"],
  [/tarjeta|visa|mastercard|card/i, "tarjeta"],
];

/** Nombre canónico → patrones con que suele aparecer en el voucher. */
const BANK_ALIASES: Array<[string, RegExp]> = [
  ["BCP", /\bbcp\b|banco de cr[eé]dito/i],
  ["Interbank", /interbank|banco internacional/i],
  ["BBVA", /bbva|continental/i],
  ["Scotiabank", /scotia/i],
  ["BanBif", /banbif|interamericano de finanzas/i],
  ["Banco de la Nación", /naci[oó]n/i],
  ["Banco Pichincha", /pichincha|financiero/i],
  ["Banco GNB", /\bgnb\b/i],
  ["Banco Falabella", /falabella/i],
  ["Banco Ripley", /ripley/i],
  ["Mibanco", /mibanco/i],
  ["Caja Arequipa", /caja\s*arequipa/i],
  ["Caja Huancayo", /caja\s*huancayo/i],
  ["Caja Piura", /caja\s*piura/i],
  ["Caja Cusco", /caja\s*cusco/i],
  ["Caja Trujillo", /caja\s*trujillo/i],
  ["Caja Sullana", /caja\s*sullana/i],
  ["Binance", /binance/i],
];

export function normalizeVoucherChannel(raw: string | null | undefined): VoucherChannel | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  for (const [pattern, channel] of CHANNEL_ALIASES) {
    if (pattern.test(value)) return channel;
  }
  return "otro";
}

export function normalizeVoucherBank(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value || /^(null|n\/?a|desconocido|ninguno)$/i.test(value)) return null;
  for (const [name, pattern] of BANK_ALIASES) {
    if (pattern.test(value)) return name;
  }
  // Banco que no está en la lista: se muestra tal cual, con mayúscula inicial.
  return value.length <= 40 ? value.replace(/^\p{Ll}/u, (c) => c.toUpperCase()) : null;
}

/**
 * Etiqueta para gerencia: "Yape", "Plin · Interbank",
 * "Transferencia interbancaria · BBVA", "Binance Pay"…
 * `destinationBank` sirve para marcar si la transferencia viene de otro banco.
 */
export function describeVoucherChannel(input: {
  channel: VoucherChannel | null;
  bank: string | null;
  destinationBank?: string | null;
}): string | null {
  const { channel, bank } = input;
  if (!channel && !bank) return null;

  switch (channel) {
    case "yape":
      return "Yape";
    case "plin":
      return bank ? `Plin · ${bank}` : "Plin";
    case "binance":
      return "Binance Pay";
    case "cripto":
      return bank && bank !== "Binance" ? `Cripto · ${bank}` : "Cripto (USDT)";
    case "deposito":
      return bank ? `Depósito · ${bank}` : "Depósito en agente";
    case "tarjeta":
      return bank ? `Tarjeta · ${bank}` : "Tarjeta";
    case "transferencia": {
      if (!bank) return "Transferencia";
      const interbank =
        input.destinationBank && bank !== input.destinationBank ? " interbancaria" : "";
      return `Transferencia${interbank} · ${bank}`;
    }
    default:
      return bank ?? null;
  }
}
