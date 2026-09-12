/**
 * A dónde se yapea y cómo reconocer las recargas del bot del chat.
 *
 * El destino va fijo en el código y no sale de MANUAL_PAYMENT_BANK_ACCOUNTS:
 * esa variable es de la recarga manual (cuentas BCP de transferencia) y el bot
 * no la debe tocar ni depender de ella.
 */
export const RECHARGE_BOT_SOURCE = "recharge_chat_bot";

export const YAPE_RECIPIENT = Object.freeze({
  phone: "964290361",
  phoneDisplay: "964 290 361",
  /** Opción que el cliente elige en Yape al poner el número. */
  bank: "BCP",
  /** Nombre que Yape le muestra antes de confirmar el pago. */
  holder: "Holistic Marketing PE EIRL",
});
