/** Cooldown entre reenvíos OTP Hecom (servidor + UI). */
export const HECOM_OTP_COOLDOWN_SECONDS = 30;

/** Typos / alias frecuentes al tipear el correo. */
export const HECOM_OTP_EMAIL_ALIASES: Record<string, string> = {
  "anniealejandrova@gmail.com": "anniealejandrova6@gmail.com",
  "annie.alejandrova6@gmail.com": "anniealejandrova6@gmail.com",
};

/** Misma normalización en login, verify y servidor (evita OTP “inválido”). */
export function normalizeHecomOtpEmail(email: string): string {
  const raw = email.trim().toLowerCase();
  return HECOM_OTP_EMAIL_ALIASES[raw] ?? raw;
}
