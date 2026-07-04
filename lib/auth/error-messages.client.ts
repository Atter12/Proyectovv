const AUTH_ERROR_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Confirma tu correo antes de iniciar sesión."],
  [/user already registered/i, "Este correo ya está registrado."],
  [/password should be at least/i, "La contraseña debe tener al menos 8 caracteres."],
  [/invalid email/i, "El correo electrónico no es válido."],
  [/token has expired|expired/i, "El código expiró. Solicita uno nuevo."],
  [/otp/i, "Código de verificación inválido."],
  [/rate limit|too many requests/i, "Demasiados intentos. Espera un momento e inténtalo de nuevo."],
  [/network|fetch failed/i, "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo."],
];

export function mapAuthErrorMessage(message: string): string {
  for (const [pattern, translation] of AUTH_ERROR_MAP) {
    if (pattern.test(message)) return translation;
  }
  return message;
}
