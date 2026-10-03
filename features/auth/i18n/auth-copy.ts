import type { LandingLocale } from "@/features/landing/i18n/landing-locale";

/**
 * Textos del acceso público (login, registro, código OTP) en es/en/pt/zh.
 * Usa el mismo idioma que la landing (`HOLISTIC_LANDING_LANG`).
 */
export type AuthCopy = {
  shell: {
    skipToForm: string;
    homeAria: string;
    language: string;
  };
  login: {
    topRightLabel: string;
    topRightPrompt: string;
    caption: string;
    title: string;
    subtitleOtp: string;
    subtitlePassword: string;
    emailLabel: string;
    emailPlaceholder: string;
    forgotEmail: string;
    lookupTitle: string;
    lookupHelp: string;
    lookupAria: string;
    lookupPlaceholder: string;
    lookupUse: string;
    lookupSearching: string;
    lookupSearch: string;
    lookupFailed: string;
    lookupRetry: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    forgotPassword: string;
    showPassword: string;
    hidePassword: string;
    magicLinkExpired: string;
    sendFailed: string;
    sendRetry: string;
    sendingCode: string;
    signingIn: string;
    getCode: string;
    signIn: string;
    troubles: string;
    recoverAccess: string;
  };
  register: {
    topRightLabel: string;
    captionTitle: string;
    captionSub: string;
    title: string;
    subtitle: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    dni: string;
    dniPlaceholder: string;
    phone: string;
    email: string;
    emailPlaceholder: string;
    referral: string;
    errFirstName: string;
    errLastName: string;
    errDni: string;
    errPhone: string;
    errEmail: string;
    failed: string;
    failedRetry: string;
    notRegisteredNotice: string;
    creating: string;
    create: string;
    haveAccount: string;
    signIn: string;
  };
  verify: {
    topRightLabel: string;
    captionTitle: string;
    captionSub: string;
    title: string;
    sentTo: string;
    yourEmail: string;
    codeLabel: string;
    helpHecom: string;
    helpOther: string;
    missingEmailBack: string;
    missingEmail: string;
    invalidCode: string;
    verifyFailed: string;
    verifyNetwork: string;
    resendFailed: string;
    resendFailedCode: string;
    resentHecom: string;
    resentOther: string;
    verifying: string;
    verify: string;
    checkSpam: string;
    resending: string;
    resendIn: (seconds: number) => string;
    resend: string;
    useLatest: string;
    useOtherEmail: string;
  };
};

const es: AuthCopy = {
  shell: {
    skipToForm: "Ir al formulario",
    homeAria: "inicio",
    language: "Idioma",
  },
  login: {
    topRightLabel: "Crear cuenta",
    topRightPrompt: "¿Aún no tienes cuenta?",
    caption: "Recarga desde cualquier país.\nImpulsa tus campañas.",
    title: "Entra a AdsHolistic.",
    subtitleOtp: "Te enviaremos un código a tu correo.",
    subtitlePassword: "Qué bueno verte de nuevo. Accede a tu panel de anunciante.",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@correo.com",
    forgotEmail: "¿No recuerdas tu correo?",
    lookupTitle: "Recuperar correo por nombre",
    lookupHelp: "Escribe tu nombre y apellido como figuran en tu cuenta.",
    lookupAria: "Nombre y apellido para recuperar tu correo",
    lookupPlaceholder: "María González Pérez",
    lookupUse: "Usar",
    lookupSearching: "Buscando…",
    lookupSearch: "Buscar mi correo",
    lookupFailed: "No se pudo buscar el correo.",
    lookupRetry: "No se pudo buscar. Vuelve a intentar.",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "Tu contraseña",
    forgotPassword: "¿Olvidaste tu contraseña?",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    magicLinkExpired: "El enlace expiró o no es válido. Pide uno nuevo.",
    sendFailed: "No se pudo enviar el código.",
    sendRetry: "No se pudo enviar el código. Vuelve a intentar.",
    sendingCode: "Enviando código…",
    signingIn: "Iniciando sesión…",
    getCode: "Recibir código",
    signIn: "Iniciar sesión",
    troubles: "¿Problemas?",
    recoverAccess: "Recuperar acceso",
  },
  register: {
    topRightLabel: "Iniciar sesión",
    captionTitle: "Una sola cartera para todas tus cuentas.",
    captionSub: "Ads Holistic, la plataforma de Holistic Marketing.",
    title: "Crea tu cuenta",
    subtitle:
      "Completa tus datos y tu DNI. Te enviaremos un código por correo para verificar tu cuenta.",
    firstName: "Nombres",
    firstNamePlaceholder: "María Fernanda",
    lastName: "Apellidos",
    lastNamePlaceholder: "Quispe Ramos",
    dni: "DNI",
    dniPlaceholder: "8 dígitos",
    phone: "Teléfono",
    email: "Correo electrónico",
    emailPlaceholder: "tu@correo.com",
    referral: "Código de referido:",
    errFirstName: "Escribe tus nombres.",
    errLastName: "Escribe tus apellidos.",
    errDni: "El DNI tiene 8 dígitos. No se acepta RUC ni pasaporte.",
    errPhone: "Escribe un teléfono válido (mínimo 9 dígitos).",
    errEmail: "Escribe un correo electrónico válido.",
    failed: "No se pudo completar el registro.",
    failedRetry: "No se pudo completar el registro. Vuelve a intentar.",
    notRegisteredNotice: "Ese correo aún no tiene cuenta, por eso no llegó el código. Completa tus datos para crearla.",
    creating: "Creando cuenta…",
    create: "Crear cuenta",
    haveAccount: "¿Ya tienes cuenta?",
    signIn: "Iniciar sesión",
  },
  verify: {
    topRightLabel: "Volver al inicio",
    captionTitle: "Revisa tu correo. El código llega en segundos.",
    captionSub: "Ads Holistic, la plataforma de Holistic Marketing.",
    title: "Revisa tu correo",
    sentTo: "Enviamos un código de 6 dígitos a",
    yourEmail: "tu correo electrónico",
    codeLabel: "Código de 6 dígitos",
    helpHecom: "También puedes entrar desde el enlace del mismo correo.",
    helpOther: "Copia y pega el código completo para verificar tu correo.",
    missingEmailBack: "Falta el correo electrónico. Vuelve al inicio de sesión.",
    missingEmail: "Falta el correo electrónico.",
    invalidCode: "Introduce un código de 6 dígitos.",
    verifyFailed: "No pudimos verificar el código. Pedí uno nuevo e intentá de nuevo.",
    verifyNetwork: "No pudimos verificar el código. Revisá tu conexión e intentá de nuevo.",
    resendFailed: "No se pudo reenviar.",
    resendFailedCode: "No se pudo reenviar el código.",
    resentHecom: "Te enviamos un código nuevo. El anterior ya no sirve.",
    resentOther: "Te enviamos un nuevo código a tu correo.",
    verifying: "Verificando código…",
    verify: "Verificar y continuar",
    checkSpam: "¿No encuentras el correo? Revisa también spam.",
    resending: "Reenviando…",
    resendIn: (s) => `Reenviar código en ${s}s`,
    resend: "Reenviar código",
    useLatest: "Si solicitas otro código, usa el más reciente.",
    useOtherEmail: "Usar otro correo",
  },
};

const en: AuthCopy = {
  shell: {
    skipToForm: "Skip to form",
    homeAria: "home",
    language: "Language",
  },
  login: {
    topRightLabel: "Create account",
    topRightPrompt: "Don't have an account yet?",
    caption: "Top up from any country.\nBoost your campaigns.",
    title: "Sign in to AdsHolistic.",
    subtitleOtp: "We'll send a code to your email.",
    subtitlePassword: "Good to see you again. Access your advertiser dashboard.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    forgotEmail: "Can't remember your email?",
    lookupTitle: "Find your email by name",
    lookupHelp: "Type your first and last name as they appear on your account.",
    lookupAria: "First and last name to find your email",
    lookupPlaceholder: "Maria Gonzalez Perez",
    lookupUse: "Use",
    lookupSearching: "Searching…",
    lookupSearch: "Find my email",
    lookupFailed: "We couldn't look up your email.",
    lookupRetry: "We couldn't search. Please try again.",
    passwordLabel: "Password",
    passwordPlaceholder: "Your password",
    forgotPassword: "Forgot your password?",
    showPassword: "Show password",
    hidePassword: "Hide password",
    magicLinkExpired: "The link has expired or is invalid. Request a new one.",
    sendFailed: "We couldn't send the code.",
    sendRetry: "We couldn't send the code. Please try again.",
    sendingCode: "Sending code…",
    signingIn: "Signing in…",
    getCode: "Get code",
    signIn: "Log in",
    troubles: "Having trouble?",
    recoverAccess: "Recover access",
  },
  register: {
    topRightLabel: "Log in",
    captionTitle: "One wallet for all your accounts.",
    captionSub: "Ads Holistic, the Holistic Marketing platform.",
    title: "Create your account",
    subtitle:
      "Fill in your details and your DNI (Peruvian ID). We'll email you a code to verify your account.",
    firstName: "First names",
    firstNamePlaceholder: "Maria Fernanda",
    lastName: "Last names",
    lastNamePlaceholder: "Quispe Ramos",
    dni: "DNI",
    dniPlaceholder: "8 digits",
    phone: "Phone",
    email: "Email",
    emailPlaceholder: "you@email.com",
    referral: "Referral code:",
    errFirstName: "Enter your first names.",
    errLastName: "Enter your last names.",
    errDni: "The DNI has 8 digits. RUC or passport numbers are not accepted.",
    errPhone: "Enter a valid phone number (at least 9 digits).",
    errEmail: "Enter a valid email address.",
    failed: "We couldn't complete your registration.",
    failedRetry: "We couldn't complete your registration. Please try again.",
    notRegisteredNotice: "That email has no account yet, so no code was sent. Fill in your details to create it.",
    creating: "Creating account…",
    create: "Create account",
    haveAccount: "Already have an account?",
    signIn: "Log in",
  },
  verify: {
    topRightLabel: "Back to login",
    captionTitle: "Check your email. The code arrives in seconds.",
    captionSub: "Ads Holistic, the Holistic Marketing platform.",
    title: "Check your email",
    sentTo: "We sent a 6-digit code to",
    yourEmail: "your email",
    codeLabel: "6-digit code",
    helpHecom: "You can also sign in from the link in the same email.",
    helpOther: "Copy and paste the full code to verify your email.",
    missingEmailBack: "Email is missing. Go back to the login page.",
    missingEmail: "Email is missing.",
    invalidCode: "Enter a 6-digit code.",
    verifyFailed: "We couldn't verify the code. Request a new one and try again.",
    verifyNetwork: "We couldn't verify the code. Check your connection and try again.",
    resendFailed: "We couldn't resend it.",
    resendFailedCode: "We couldn't resend the code.",
    resentHecom: "We sent you a new code. The previous one no longer works.",
    resentOther: "We sent a new code to your email.",
    verifying: "Verifying code…",
    verify: "Verify and continue",
    checkSpam: "Can't find the email? Check your spam folder too.",
    resending: "Resending…",
    resendIn: (s) => `Resend code in ${s}s`,
    resend: "Resend code",
    useLatest: "If you request another code, use the most recent one.",
    useOtherEmail: "Use a different email",
  },
};

const zh: AuthCopy = {
  shell: {
    skipToForm: "跳到表单",
    homeAria: "首页",
    language: "语言",
  },
  login: {
    topRightLabel: "创建账户",
    topRightPrompt: "还没有账户？",
    caption: "在任何国家都能充值。\n助力你的广告投放。",
    title: "登录 AdsHolistic",
    subtitleOtp: "我们会向你的邮箱发送验证码。",
    subtitlePassword: "欢迎回来。进入你的广告主面板。",
    emailLabel: "电子邮箱",
    emailPlaceholder: "you@email.com",
    forgotEmail: "忘记邮箱了？",
    lookupTitle: "通过姓名找回邮箱",
    lookupHelp: "请输入账户上登记的姓名。",
    lookupAria: "用于找回邮箱的姓名",
    lookupPlaceholder: "María González Pérez",
    lookupUse: "使用",
    lookupSearching: "正在查找…",
    lookupSearch: "查找我的邮箱",
    lookupFailed: "无法查找邮箱。",
    lookupRetry: "查找失败，请重试。",
    passwordLabel: "密码",
    passwordPlaceholder: "你的密码",
    forgotPassword: "忘记密码？",
    showPassword: "显示密码",
    hidePassword: "隐藏密码",
    magicLinkExpired: "链接已过期或无效，请重新获取。",
    sendFailed: "验证码发送失败。",
    sendRetry: "验证码发送失败，请重试。",
    sendingCode: "正在发送验证码…",
    signingIn: "正在登录…",
    getCode: "获取验证码",
    signIn: "登录",
    troubles: "遇到问题？",
    recoverAccess: "找回访问权限",
  },
  register: {
    topRightLabel: "登录",
    captionTitle: "一个钱包，管理你的所有账户。",
    captionSub: "Ads Holistic，Holistic Marketing 旗下平台。",
    title: "创建账户",
    subtitle: "请填写你的信息和 DNI（秘鲁身份证）。我们会通过邮件发送验证码来验证你的账户。",
    firstName: "名字",
    firstNamePlaceholder: "María Fernanda",
    lastName: "姓氏",
    lastNamePlaceholder: "Quispe Ramos",
    dni: "DNI（秘鲁身份证）",
    dniPlaceholder: "8 位数字",
    phone: "电话",
    email: "电子邮箱",
    emailPlaceholder: "you@email.com",
    referral: "推荐码：",
    errFirstName: "请输入你的名字。",
    errLastName: "请输入你的姓氏。",
    errDni: "DNI 为 8 位数字，不接受 RUC 或护照号码。",
    errPhone: "请输入有效的电话号码（至少 9 位数字）。",
    errEmail: "请输入有效的电子邮箱。",
    failed: "注册未能完成。",
    failedRetry: "注册未能完成，请重试。",
    notRegisteredNotice: "该邮箱还没有账户，所以没有收到验证码。请填写信息创建账户。",
    creating: "正在创建账户…",
    create: "创建账户",
    haveAccount: "已有账户？",
    signIn: "登录",
  },
  verify: {
    topRightLabel: "返回登录",
    captionTitle: "请查看邮箱，验证码几秒内即可送达。",
    captionSub: "Ads Holistic，Holistic Marketing 旗下平台。",
    title: "请查看你的邮箱",
    sentTo: "我们已将 6 位验证码发送至",
    yourEmail: "你的电子邮箱",
    codeLabel: "6 位验证码",
    helpHecom: "你也可以通过同一封邮件中的链接登录。",
    helpOther: "复制并粘贴完整验证码以验证你的邮箱。",
    missingEmailBack: "缺少电子邮箱，请返回登录页面。",
    missingEmail: "缺少电子邮箱。",
    invalidCode: "请输入 6 位验证码。",
    verifyFailed: "验证码验证失败，请重新获取后再试。",
    verifyNetwork: "验证码验证失败，请检查网络连接后重试。",
    resendFailed: "重新发送失败。",
    resendFailedCode: "验证码重新发送失败。",
    resentHecom: "我们已发送新的验证码，之前的验证码已失效。",
    resentOther: "我们已向你的邮箱发送新的验证码。",
    verifying: "正在验证…",
    verify: "验证并继续",
    checkSpam: "找不到邮件？也请查看垃圾邮件文件夹。",
    resending: "正在重新发送…",
    resendIn: (s) => `${s} 秒后可重新发送`,
    resend: "重新发送验证码",
    useLatest: "如果你再次获取验证码，请使用最新的那一个。",
    useOtherEmail: "使用其他邮箱",
  },
};

const pt: AuthCopy = {
  shell: {
    skipToForm: "Ir para o formulário",
    homeAria: "início",
    language: "Idioma",
  },
  login: {
    topRightLabel: "Criar conta",
    topRightPrompt: "Ainda não tem conta?",
    caption: "Recarregue de qualquer país.\nImpulsione suas campanhas.",
    title: "Entre na AdsHolistic.",
    subtitleOtp: "Vamos enviar um código para o seu e-mail.",
    subtitlePassword: "Que bom te ver de novo. Acesse seu painel de anunciante.",
    emailLabel: "E-mail",
    emailPlaceholder: "voce@email.com",
    forgotEmail: "Não lembra seu e-mail?",
    lookupTitle: "Recuperar e-mail pelo nome",
    lookupHelp: "Escreva seu nome e sobrenome como aparecem na sua conta.",
    lookupAria: "Nome e sobrenome para recuperar seu e-mail",
    lookupPlaceholder: "Maria Souza Oliveira",
    lookupUse: "Usar",
    lookupSearching: "Buscando…",
    lookupSearch: "Buscar meu e-mail",
    lookupFailed: "Não foi possível buscar o e-mail.",
    lookupRetry: "Não foi possível buscar. Tente de novo.",
    passwordLabel: "Senha",
    passwordPlaceholder: "Sua senha",
    forgotPassword: "Esqueceu sua senha?",
    showPassword: "Mostrar senha",
    hidePassword: "Ocultar senha",
    magicLinkExpired: "O link expirou ou não é válido. Peça um novo.",
    sendFailed: "Não foi possível enviar o código.",
    sendRetry: "Não foi possível enviar o código. Tente de novo.",
    sendingCode: "Enviando código…",
    signingIn: "Entrando…",
    getCode: "Receber código",
    signIn: "Entrar",
    troubles: "Problemas?",
    recoverAccess: "Recuperar acesso",
  },
  register: {
    topRightLabel: "Entrar",
    captionTitle: "Uma só carteira para todas as suas contas.",
    captionSub: "Ads Holistic, a plataforma da Holistic Marketing.",
    title: "Crie sua conta",
    subtitle:
      "Preencha seus dados e seu documento (DNI). Vamos enviar um código por e-mail para verificar sua conta.",
    firstName: "Nome",
    firstNamePlaceholder: "Maria Fernanda",
    lastName: "Sobrenome",
    lastNamePlaceholder: "Souza Oliveira",
    dni: "Documento (DNI)",
    dniPlaceholder: "8 dígitos",
    phone: "Telefone",
    email: "E-mail",
    emailPlaceholder: "voce@email.com",
    referral: "Código de indicação:",
    errFirstName: "Escreva seu nome.",
    errLastName: "Escreva seu sobrenome.",
    errDni: "O DNI tem 8 dígitos. Não aceitamos RUC nem passaporte.",
    errPhone: "Escreva um telefone válido (mínimo 9 dígitos).",
    errEmail: "Escreva um e-mail válido.",
    failed: "Não foi possível concluir o cadastro.",
    failedRetry: "Não foi possível concluir o cadastro. Tente de novo.",
    notRegisteredNotice: "Esse e-mail ainda não tem conta, por isso o código não chegou. Preencha seus dados para criá-la.",
    creating: "Criando conta…",
    create: "Criar conta",
    haveAccount: "Já tem conta?",
    signIn: "Entrar",
  },
  verify: {
    topRightLabel: "Voltar ao início",
    captionTitle: "Confira seu e-mail. O código chega em segundos.",
    captionSub: "Ads Holistic, a plataforma da Holistic Marketing.",
    title: "Confira seu e-mail",
    sentTo: "Enviamos um código de 6 dígitos para",
    yourEmail: "seu e-mail",
    codeLabel: "Código de 6 dígitos",
    helpHecom: "Você também pode entrar pelo link do mesmo e-mail.",
    helpOther: "Copie e cole o código completo para verificar seu e-mail.",
    missingEmailBack: "Falta o e-mail. Volte para o login.",
    missingEmail: "Falta o e-mail.",
    invalidCode: "Digite um código de 6 dígitos.",
    verifyFailed: "Não conseguimos verificar o código. Peça um novo e tente de novo.",
    verifyNetwork: "Não conseguimos verificar o código. Confira sua conexão e tente de novo.",
    resendFailed: "Não foi possível reenviar.",
    resendFailedCode: "Não foi possível reenviar o código.",
    resentHecom: "Enviamos um código novo. O anterior não vale mais.",
    resentOther: "Enviamos um novo código para o seu e-mail.",
    verifying: "Verificando código…",
    verify: "Verificar e continuar",
    checkSpam: "Não encontrou o e-mail? Confira também o spam.",
    resending: "Reenviando…",
    resendIn: (s) => `Reenviar código em ${s}s`,
    resend: "Reenviar código",
    useLatest: "Se pedir outro código, use o mais recente.",
    useOtherEmail: "Usar outro e-mail",
  },
};

const copies: Record<LandingLocale, AuthCopy> = { es, en, zh, pt };

export function getAuthCopy(locale: LandingLocale): AuthCopy {
  return copies[locale];
}
