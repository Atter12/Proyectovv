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
  appName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Ecomdy",
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

  paymentsDefaultProvider: process.env.PAYMENTS_DEFAULT_PROVIDER ?? "manual",
  paymentsAllowManualProvider: parseBoolean(process.env.PAYMENTS_ALLOW_MANUAL_PROVIDER),
  paymentsManualEnabled: parseBoolean(process.env.PAYMENTS_MANUAL_ENABLED),
  paymentsAllowSandboxSuccess: parseBoolean(process.env.PAYMENTS_ALLOW_SANDBOX_SUCCESS),

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

  emailProvider: process.env.EMAIL_PROVIDER ?? "none",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom:
    process.env.EMAIL_FROM ??
    `${process.env.NEXT_PUBLIC_SITE_NAME ?? "Ecomdy"} <no-reply@example.com>`,
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
} as const;
