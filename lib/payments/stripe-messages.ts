/** Mensajes claros en español para errores comunes de Stripe. */
export function formatStripeErrorForUser(message: string): string {
  const m = message.trim().toLowerCase();

  if (m.includes("missing required param: currency")) {
    return "No se pudo abrir el formulario de tarjeta. Inténtalo de nuevo en unos segundos.";
  }
  if (m.includes("no such customer")) {
    return "Tu perfil de pago expiró. Vuelve a guardar la tarjeta.";
  }
  if (m.includes("no such payment_method") || m.includes("payment_method")) {
    return "La tarjeta no es válida o fue eliminada. Guarda una tarjeta nueva.";
  }
  if (m.includes("card was declined") || m.includes("your card was declined")) {
    return "La tarjeta fue rechazada. Prueba con otra tarjeta o contacta con tu banco.";
  }
  if (m.includes("authentication_required")) {
    return "Tu banco solicita una verificación adicional. Vuelve a guardar la tarjeta y completa la validación.";
  }
  if (m.includes("stripe no configurado")) {
    return "Los pagos con tarjeta no están disponibles en este momento.";
  }
  if (m.includes("guarda una tarjeta") || m.includes("guarda una tarjeta")) {
    return "Primero guarda una tarjeta y luego activa el débito automático.";
  }
  if (m.includes("monto mínimo")) {
    return "El monto mínimo de recarga es $10 USD.";
  }
  if (m.includes("monto máximo")) {
    return "El monto máximo de recarga es $5,000 USD.";
  }
  if (m.includes("intervalo inválido")) {
    return "Elige cada cuántos días realizar el débito: 15, 20 o 30.";
  }

  if (/^[a-z0-9_ .:-]+$/i.test(message) && message.includes("Missing required param")) {
    return "No se pudo completar el pago. Inténtalo de nuevo o contacta con soporte.";
  }

  return message || "Ocurrió un error. Inténtalo de nuevo.";
}
