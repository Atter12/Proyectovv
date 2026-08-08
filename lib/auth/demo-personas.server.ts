import "server-only";

/**
 * Cuentas demo / prueba (Holistic) — se resuelven por email, no por org role.
 * Útil para validar UI Cliente vs Gerente con los mismos flujos.
 */
const DEMO_CLIENTE_EMAILS = ["ferbasiliorengifo@gmail.com"] as const;

const DEMO_GERENTE_EMAILS = ["atlvbasiliorengifo@gmail.com"] as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Cliente OTP + Pagos solo Stripe / cartera (nunca staff ni BM dual). */
export function isDemoClienteEmail(emailRaw: string): boolean {
  const email = normalizeEmail(emailRaw);
  return (
    email.length > 0 &&
    (DEMO_CLIENTE_EMAILS as readonly string[]).includes(email)
  );
}

/** Gerente — lista de clientes + fondeo BM (sin Stripe como camino principal). */
export function isDemoGerenteEmail(emailRaw: string): boolean {
  const email = normalizeEmail(emailRaw);
  return (
    email.length > 0 &&
    (DEMO_GERENTE_EMAILS as readonly string[]).includes(email)
  );
}

/** Puede entrar por OTP aunque no esté en Hecom (cliente demo). */
export function isDemoOtpClienteEmail(emailRaw: string): boolean {
  return isDemoClienteEmail(emailRaw);
}
