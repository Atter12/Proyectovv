import type { LandingLocale } from "@/features/landing/i18n/landing-locale";

type AuthMessageLocale = LandingLocale;

/**
 * Patrón → texto por idioma. Si falta `es`, en español se muestra el mensaje
 * original del servidor (ya viene en español).
 */
const AUTH_ERROR_MAP: Array<[RegExp, Partial<Record<AuthMessageLocale, string>>]> = [
  [
    /invalid login credentials/i,
    {
      es: "Correo o contraseña incorrectos.",
      en: "Incorrect email or password.",
      pt: "E-mail ou senha incorretos.",
      zh: "邮箱或密码错误。",
    },
  ],
  [
    /email not confirmed/i,
    {
      es: "Confirma tu correo antes de iniciar sesión.",
      en: "Confirm your email before logging in.",
      pt: "Confirme seu e-mail antes de entrar.",
      zh: "登录前请先验证你的邮箱。",
    },
  ],
  [
    /user already registered/i,
    {
      es: "Este correo ya está registrado.",
      en: "This email is already registered.",
      pt: "Este e-mail já está cadastrado.",
      zh: "该邮箱已注册。",
    },
  ],
  [
    /password should be at least/i,
    {
      es: "La contraseña debe tener al menos 8 caracteres.",
      en: "The password must be at least 8 characters long.",
      pt: "A senha deve ter pelo menos 8 caracteres.",
      zh: "密码至少需要 8 个字符。",
    },
  ],
  [
    /invalid email/i,
    {
      es: "El correo electrónico no es válido.",
      en: "The email address is not valid.",
      pt: "O e-mail não é válido.",
      zh: "电子邮箱无效。",
    },
  ],
  // Mensajes propios del servidor (vienen en español).
  [
    /espera \d+s antes de buscar/i,
    {
      en: "Wait a few seconds before searching again.",
      pt: "Espere alguns segundos antes de buscar de novo.",
      zh: "请稍等几秒再重新查找。",
    },
  ],
  [
    /espera \d+s antes/i,
    {
      es: "Espera unos segundos antes de pedir otro código.",
      en: "Wait a few seconds before requesting another code.",
      pt: "Espere alguns segundos antes de pedir outro código.",
      zh: "请稍等几秒再获取新的验证码。",
    },
  ],
  [
    /si tu correo está habilitado/i,
    {
      en: "If your email is enabled, we sent you a code and a magic link.",
      pt: "Se o seu e-mail estiver habilitado, enviamos um código e um link de acesso.",
      zh: "如果你的邮箱已开通，我们已向你发送验证码和登录链接。",
    },
  ],
  [
    /te enviamos un código y un enlace mágico/i,
    {
      en: "We sent you a code and a magic link. Check your inbox and spam folder.",
      pt: "Enviamos um código e um link de acesso. Confira sua caixa de entrada e o spam.",
      zh: "我们已向你发送验证码和登录链接。请查看收件箱和垃圾邮件。",
    },
  ],
  [
    /ya tienes una cuenta con ese correo/i,
    {
      en: "You already have an account with that email. Please log in.",
      pt: "Você já tem uma conta com esse e-mail. Entre.",
      zh: "该邮箱已有账户，请直接登录。",
    },
  ],
  [
    /ingresa tu nombre completo/i,
    {
      en: "Enter your full name.",
      pt: "Escreva seu nome completo.",
      zh: "请输入你的全名。",
    },
  ],
  [
    /ingresa tu dni/i,
    {
      en: "Enter your DNI (exactly 8 digits). RUC or passport numbers are not accepted.",
      pt: "Escreva seu DNI (exatamente 8 dígitos). Não aceitamos RUC nem passaporte.",
      zh: "请输入你的 DNI（正好 8 位数字），不接受 RUC 或护照号码。",
    },
  ],
  [
    /ingresa un (número telefónico|teléfono) válido/i,
    {
      en: "Enter a valid phone number (at least 9 digits).",
      pt: "Escreva um telefone válido (mínimo 9 dígitos).",
      zh: "请输入有效的电话号码（至少 9 位数字）。",
    },
  ],
  [
    /correo( electrónico)? inválido/i,
    {
      en: "Invalid email.",
      pt: "E-mail inválido.",
      zh: "电子邮箱无效。",
    },
  ],
  [
    /introduce un código de 6 dígitos/i,
    {
      en: "Enter a 6-digit code.",
      pt: "Digite um código de 6 dígitos.",
      zh: "请输入 6 位验证码。",
    },
  ],
  [
    /escribe al menos \d+ letras/i,
    {
      en: "Type at least 4 letters (ideally your first and last name).",
      pt: "Escreva pelo menos 4 letras (de preferência nome e sobrenome).",
      zh: "请至少输入 4 个字母（最好是名字和姓氏）。",
    },
  ],
  [
    /no encontramos ese nombre/i,
    {
      en: "We couldn't find that name with an email in Hecom. Try your first and last name, or type your email if you remember it.",
      pt: "Não encontramos esse nome com um e-mail na Hecom. Tente nome e sobrenome, ou escreva seu e-mail se lembrar.",
      zh: "在 Hecom 中未找到该姓名对应的邮箱。请尝试输入名字和姓氏，或直接输入你记得的邮箱。",
    },
  ],
  [
    /encontramos este correo/i,
    {
      en: "We found this email. Tap it to use it and log in.",
      pt: "Encontramos este e-mail. Toque nele para usar e entrar.",
      zh: "找到了这个邮箱。点击即可使用并登录。",
    },
  ],
  [
    /encontramos varias coincidencias/i,
    {
      en: "We found several matches. Choose yours.",
      pt: "Encontramos vários resultados. Escolha o seu.",
      zh: "找到多个匹配结果，请选择你的。",
    },
  ],
  [
    /token has expired|otp.*expired|expired.*otp|otp_expired/i,
    {
      es: "Ese código ya no sirve. Pedí uno nuevo (el anterior deja de valer al reenviar).",
      en: "That code is no longer valid. Request a new one (the previous one stops working when you resend).",
      pt: "Esse código não vale mais. Peça um novo (o anterior deixa de funcionar quando você reenvia).",
      zh: "该验证码已失效。请重新获取（重新发送后旧验证码将失效）。",
    },
  ],
  [
    /invalid.*otp|otp.*invalid|token.*invalid|otp_disabled/i,
    {
      es: "Código incorrecto o ya usado. Revisá los 6 dígitos o pedí uno nuevo.",
      en: "Incorrect or already used code. Check the 6 digits or request a new one.",
      pt: "Código incorreto ou já usado. Confira os 6 dígitos ou peça um novo.",
      zh: "验证码错误或已使用。请检查 6 位数字或重新获取。",
    },
  ],
  [
    /rate limit|too many requests/i,
    {
      es: "Demasiados intentos. Esperá un momento e intentá de nuevo.",
      en: "Too many attempts. Wait a moment and try again.",
      pt: "Muitas tentativas. Espere um pouco e tente de novo.",
      zh: "尝试次数过多，请稍后再试。",
    },
  ],
  [
    /network|fetch failed|failed to fetch|load failed|connection/i,
    {
      es: "No pudimos verificar el código. Revisá tu conexión e intentá de nuevo.",
      en: "We couldn't verify the code. Check your connection and try again.",
      pt: "Não conseguimos verificar o código. Confira sua conexão e tente de novo.",
      zh: "验证码验证失败，请检查网络连接后重试。",
    },
  ],
  [
    /no pudimos verificar el código/i,
    {
      es: "No pudimos verificar el código. Pedí uno nuevo e intentá de nuevo.",
      en: "We couldn't verify the code. Request a new one and try again.",
      pt: "Não conseguimos verificar o código. Peça um novo e tente de novo.",
      zh: "验证码验证失败，请重新获取后再试。",
    },
  ],
];

/** Respaldo para mensajes del servidor sin traducción (en/pt/zh). */
const GENERIC_FALLBACK: Record<Exclude<AuthMessageLocale, "es">, string> = {
  en: "Something went wrong. Please try again.",
  pt: "Algo deu errado. Tente de novo.",
  zh: "出了点问题，请重试。",
};

function findTranslation(message: string, locale: AuthMessageLocale): string | null {
  for (const [pattern, translations] of AUTH_ERROR_MAP) {
    if (pattern.test(message)) return translations[locale] ?? message;
  }
  return null;
}

export function mapAuthErrorMessage(
  message: string,
  locale: AuthMessageLocale = "es",
): string {
  return (
    findTranslation(message, locale) ??
    (locale === "es" ? message : GENERIC_FALLBACK[locale])
  );
}

/** Para avisos informativos: traduce si se conoce, si no deja el original. */
export function localizeAuthNotice(message: string, locale: AuthMessageLocale): string {
  return findTranslation(message, locale) ?? message;
}
