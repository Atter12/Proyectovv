import "server-only";

/**
 * Cuentas demo / prueba (Holistic) — se resuelven por email, no por org role.
 *
 * ferbasiliorengifo: fuerza UI **Cliente** (Stripe), aunque el perfil en
 * Supabase sea owner (si no, cae a Gerente). El cliente Hecom real se toma
 * del array `emails` en CRM (ej. Adriana Trujillo), no el otp-test sintético.
 */
const DEMO_CLIENTE_EMAILS: readonly string[] = [
  "ferbasiliorengifo@gmail.com",
];

const DEMO_GERENTE_EMAILS = ["atlvbasiliorengifo@gmail.com"] as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Cliente OTP + Pagos solo Stripe / cartera (nunca staff ni BM dual). */
export function isDemoClienteEmail(emailRaw: string): boolean {
  const email = normalizeEmail(emailRaw);
  return email.length > 0 && DEMO_CLIENTE_EMAILS.includes(email);
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
