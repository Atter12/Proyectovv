/** Mensajes claros en español para errores comunes de Stripe. */
export function formatStripeErrorForUser(message: string): string {
  const m = message.trim().toLowerCase();

  if (m.includes("missing required param: currency")) {
    return "No se pudo abrir el formulario de tarjeta. Intentá de nuevo en unos segundos.";
  }
  if (m.includes("no such customer")) {
    return "Tu perfil de pago expiró. Volvé a guardar la tarjeta.";
  }
  if (m.includes("no such payment_method") || m.includes("payment_method")) {
    return "La tarjeta no es válida o fue eliminada. Guardá una tarjeta nueva.";
  }
  if (m.includes("card was declined") || m.includes("your card was declined")) {
    return "La tarjeta fue rechazada. Probá con otra tarjeta o contactá a tu banco.";
  }
  if (m.includes("authentication_required")) {
    return "Tu banco pide verificación adicional. Volvé a guardar la tarjeta y completá la validación.";
  }
  if (m.includes("stripe no configurado")) {
    return "Los pagos con tarjeta no están disponibles en este momento.";
  }
  if (m.includes("guardá una tarjeta")) {
    return "Primero guardá una tarjeta y después activá la recarga automática.";
  }
  if (m.includes("monto mínimo")) {
    return "El monto mínimo de recarga es $10 USD.";
  }
  if (m.includes("monto máximo")) {
    return "El monto máximo de recarga es $5,000 USD.";
  }
  if (m.includes("intervalo inválido")) {
    return "Elegí cada cuántos días recargar: 15, 20 o 30.";
  }

  if (/^[a-z0-9_ .:-]+$/i.test(message) && message.includes("Missing required param")) {
    return "No se pudo completar el pago. Intentá de nuevo o contactá soporte.";
  }

  return message || "Ocurrió un error. Intentá de nuevo.";
}
