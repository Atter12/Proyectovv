const AUTH_ERROR_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Confirma tu correo antes de iniciar sesión."],
  [/user already registered/i, "Este correo ya está registrado."],
  [/password should be at least/i, "La contraseña debe tener al menos 8 caracteres."],
  [/invalid email/i, "El correo electrónico no es válido."],
  [/espera \d+s antes/i, "Espera unos segundos antes de pedir otro código."],
  [
    /token has expired|otp.*expired|expired.*otp|otp_expired/i,
    "Ese código ya no sirve. Pedí uno nuevo (el anterior deja de valer al reenviar).",
  ],
  [
    /invalid.*otp|otp.*invalid|token.*invalid|otp_disabled/i,
    "Código incorrecto o ya usado. Revisá los 6 dígitos o pedí uno nuevo.",
  ],
  [/rate limit|too many requests/i, "Demasiados intentos. Esperá un momento e intentá de nuevo."],
  [
    /network|fetch failed|failed to fetch|load failed|connection/i,
    "No pudimos verificar el código. Revisá tu conexión e intentá de nuevo.",
  ],
  [
    /no pudimos verificar el código/i,
    "No pudimos verificar el código. Pedí uno nuevo e intentá de nuevo.",
  ],
];

export function mapAuthErrorMessage(message: string): string {
  for (const [pattern, translation] of AUTH_ERROR_MAP) {
    if (pattern.test(message)) return translation;
  }
  return message;
}
