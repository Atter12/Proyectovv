function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const appEnv = process.env.APP_ENV ?? nodeEnv;
const isProduction = nodeEnv === "production" || appEnv === "production";

export function assertProductionSecrets(): void {
  if (!isProduction) return;

  const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const validateEnvAtBuild = parseBoolean(process.env.VALIDATE_ENV_AT_BUILD, false);
  if (isNextBuildPhase && !validateEnvAtBuild) return;

  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL");
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.SUPABASE_ANON_KEY
  ) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    missing.push("NEXT_PUBLIC_APP_URL");
  }
  if (!process.env.ENCRYPTION_KEY) {
    missing.push("ENCRYPTION_KEY");
  }
  if (!process.env.INTERNAL_JOB_SECRET && !process.env.CRON_SECRET) {
    missing.push("INTERNAL_JOB_SECRET o CRON_SECRET");
  }

  if (process.env.EMAIL_PROVIDER === "resend" && !process.env.RESEND_API_KEY) {
    missing.push("RESEND_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Variables obligatorias en producción: ${missing.join(", ")}`,
    );
  }
}

export const serverEnv = {
  appEnv,
  appName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Holistic Marketing",
  supportEmail: process.env.SUPPORT_EMAIL ?? "soporte@example.com",
  supabaseUrl:
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "",
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  directUrl:
    process.env.DIRECT_DATABASE_URL ?? process.env.DIRECT_URL ?? "",
  apiBaseUrl: process.env.API_BASE_URL ?? "",
  apiKey: process.env.API_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  nodeEnv,
  isProduction,

  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  internalJobSecret: process.env.INTERNAL_JOB_SECRET ?? process.env.CRON_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? process.env.INTERNAL_JOB_SECRET ?? "",
  webhookGlobalSecret: process.env.WEBHOOK_GLOBAL_SECRET ?? "",
  adminAllowedEmails: splitCsv(process.env.ADMIN_ALLOWED_EMAILS).map((email) => email.toLowerCase()),
  adminAllowedUserIds: splitCsv(process.env.ADMIN_ALLOWED_USER_IDS),
  customerAppUrl: process.env.CUSTOMER_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  authHecomOtpLogin: parseBoolean(process.env.AUTH_HECOM_OTP_LOGIN, false),
  authClerkLogin: parseBoolean(process.env.AUTH_CLERK_LOGIN, false),
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  authHecomOtpTestEmails: splitCsv(process.env.AUTH_HECOM_OTP_TEST_EMAILS).map((email) =>
    email.toLowerCase(),
  ),
  // Gerentes / staff: OTP + lista completa de clientes (no scope a 1 cliente).
  authHecomOtpStaffEmails: splitCsv(process.env.AUTH_HECOM_OTP_STAFF_EMAILS).map((email) =>
    email.toLowerCase(),
  ),
  // Super admin Pagos: Cliente (Stripe) + Gerente (BM). Default: Atter.
  paymentsSuperAdminEmails: splitCsv(process.env.PAYMENTS_SUPER_ADMIN_EMAILS).map((email) =>
    email.toLowerCase(),
  ),

  paymentsDefaultProvider: process.env.PAYMENTS_DEFAULT_PROVIDER ?? "manual",
  paymentsAllowManualProvider: parseBoolean(process.env.PAYMENTS_ALLOW_MANUAL_PROVIDER),
  paymentsManualEnabled: parseBoolean(process.env.PAYMENTS_MANUAL_ENABLED),
  paymentsAllowSandboxSuccess: parseBoolean(process.env.PAYMENTS_ALLOW_SANDBOX_SUCCESS),

  /** Tipo de cambio venta USD→PEN para pago manual (fijado al crear intent). */
  holisticUsdPenRate: Number.parseFloat(process.env.HOLISTIC_USD_PEN_RATE ?? "3.48"),
  /** JSON array de cuentas bancarias / Yape para pago manual. */
  manualPaymentBankAccountsJson: process.env.MANUAL_PAYMENT_BANK_ACCOUNTS ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiVisionModel: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
  /** Sin IA: auto-acredita al subir voucher (solo staging / demo; nunca en producción). */
  manualVoucherTrustUpload:
    isProduction ? false : parseBoolean(process.env.MANUAL_VOUCHER_TRUST_UPLOAD),
  /** Máx. USD netos en cartera para auto-aprobación IA. */
  manualVoucherAutoApproveMaxUsd: Number.parseFloat(
    process.env.MANUAL_VOUCHER_AUTO_APPROVE_MAX_USD ?? "500",
  ),
  /** Máx. comprobantes subidos por org/hora antes de forzar revisión manual. */
  manualVoucherMaxUploadsPerHour: parseInteger(
    process.env.MANUAL_VOUCHER_MAX_UPLOADS_PER_HOUR,
    3,
  ),
  /** Máx. auto-aprobaciones por org en 10 min antes de pausar IA. */
  manualVoucherMaxAutoApprovesPer10Min: parseInteger(
    process.env.MANUAL_VOUCHER_MAX_AUTO_APPROVES_PER_10MIN,
    2,
  ),
  /** Tope duro: rechaza subida si se supera en 1 hora (anti-abuso). */
  manualVoucherHardUploadCapPerHour: parseInteger(
    process.env.MANUAL_VOUCHER_HARD_UPLOAD_CAP_PER_HOUR,
    10,
  ),

  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeWebhookToleranceSeconds: parseInteger(
    process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS,
    300,
  ),

  culqiSecretKey:
    process.env.CULQI_PRIVATE_KEY ?? process.env.CULQI_SECRET_KEY ?? "",
  culqiPrivateKey:
    process.env.CULQI_PRIVATE_KEY ?? process.env.CULQI_SECRET_KEY ?? "",
  culqiPublicKey: process.env.CULQI_PUBLIC_KEY ?? "",
  culqiWebhookSecret: process.env.CULQI_WEBHOOK_SECRET ?? "",
  culqiEnv: process.env.CULQI_ENV ?? (isProduction ? "production" : "sandbox"),

  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
  mercadoPagoPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "",
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
  mercadoPagoSuccessUrl: process.env.MERCADOPAGO_SUCCESS_URL ?? "",
  mercadoPagoFailureUrl: process.env.MERCADOPAGO_FAILURE_URL ?? "",
  mercadoPagoPendingUrl: process.env.MERCADOPAGO_PENDING_URL ?? "",
  mercadoPagoWebhookToleranceSeconds: parseInteger(
    process.env.MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS,
    300,
  ),

  /** NOWPayments (cripto). Sandbox: api-sandbox.nowpayments.io */
  nowPaymentsApiKey: process.env.NOWPAYMENTS_API_KEY ?? "",
  nowPaymentsIpnSecret: process.env.NOWPAYMENTS_IPN_SECRET ?? "",
  nowPaymentsSandbox: parseBoolean(process.env.NOWPAYMENTS_SANDBOX, !isProduction),
  /** Opcional: forzar moneda (ej. usdttrc20). Vacío = el cliente elige en el checkout. */
  // Victor: solo USDT por ahora. Default TRC20 (fees bajos). Override con NOWPAYMENTS_PAY_CURRENCY.
  nowPaymentsPayCurrency:
    process.env.NOWPAYMENTS_PAY_CURRENCY?.trim() || "usdttrc20",

  // Si hay RESEND_API_KEY y no fijaron provider, usamos Resend.
  emailProvider:
    process.env.EMAIL_PROVIDER ??
    (process.env.RESEND_API_KEY ? "resend" : "none"),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom:
    process.env.EMAIL_FROM ??
    process.env.RESEND_FROM ??
    `${process.env.NEXT_PUBLIC_SITE_NAME ?? "Holistic Marketing"} <no-reply@example.com>`,
  emailReplyTo: process.env.EMAIL_REPLY_TO ?? process.env.SUPPORT_EMAIL ?? "",

  tiktokClientKey: process.env.TIKTOK_CLIENT_KEY ?? process.env.TIKTOK_APP_ID ?? "",
  tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
  tiktokRedirectUri:
    process.env.TIKTOK_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/tiktok/callback`,
  tiktokAuthUrl:
    process.env.TIKTOK_AUTH_BASE_URL ??
    process.env.TIKTOK_AUTH_URL ??
    "https://business-api.tiktok.com/portal/auth",
  tiktokAuthBaseUrl:
    process.env.TIKTOK_AUTH_BASE_URL ??
    process.env.TIKTOK_AUTH_URL ??
    "https://business-api.tiktok.com/portal/auth",
  tiktokApiBaseUrl:
    process.env.TIKTOK_API_BASE_URL ?? "https://business-api.tiktok.com/open_api/v1.3",
  tiktokScopes: splitCsv(process.env.TIKTOK_SCOPES),
  tiktokWebhookSecret: process.env.TIKTOK_WEBHOOK_SECRET ?? "",
  /**
   * Token de agencia (long-lived) para BC finance / transfer.
   * Si no hay OAuth por org, se usa este.
   */
  tiktokAccessToken: process.env.TIKTOK_ACCESS_TOKEN ?? "",
  /** BC por defecto cuando la cuenta no tiene external_business_id */
  tiktokDefaultBcId: process.env.TIKTOK_DEFAULT_BC_ID ?? "",
  /**
   * Si true, "Asignar saldo" intenta POST /bc/transfer/ (RECHARGE)
   * antes de acreditar el ledger Holistic.
   */
  tiktokBcFundingEnabled: parseBoolean(process.env.TIKTOK_BC_FUNDING_ENABLED, false),
  /**
   * Si true, al aprobar un draft Agent Pro se publica en TikTok
   * (upload video/image + campaign/adgroup/ad en PAUSED).
   */
  tiktokCreativePublishEnabled: parseBoolean(
    process.env.TIKTOK_CREATIVE_PUBLISH_ENABLED,
    false,
  ),
} as const;
