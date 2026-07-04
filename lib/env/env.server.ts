export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;

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

  if (missing.length > 0) {
    throw new Error(
      `[env] Variables obligatorias en producción: ${missing.join(", ")}`,
    );
  }
}

const isProduction = process.env.NODE_ENV === "production";

export const serverEnv = {
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
  directUrl: process.env.DIRECT_URL ?? "",
  apiBaseUrl: process.env.API_BASE_URL ?? "",
  apiKey: process.env.API_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction,
  paymentsDefaultProvider: process.env.PAYMENTS_DEFAULT_PROVIDER ?? "manual",
  paymentsAllowManualProvider: process.env.PAYMENTS_ALLOW_MANUAL_PROVIDER === "true",
  paymentsManualEnabled: process.env.PAYMENTS_MANUAL_ENABLED === "true",
  paymentsAllowSandboxSuccess: process.env.PAYMENTS_ALLOW_SANDBOX_SUCCESS === "true",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  culqiSecretKey: process.env.CULQI_SECRET_KEY ?? "",
  culqiPublicKey: process.env.CULQI_PUBLIC_KEY ?? "",
  culqiWebhookSecret: process.env.CULQI_WEBHOOK_SECRET ?? "",
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
} as const;
