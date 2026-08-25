/** Clerk helpers for Holistic / Proyectovv auth */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function envTruthy(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  return TRUTHY.has(value.toLowerCase());
}

export function clerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

/** Satellite domain (adsholistic.com) — required on prod when sharing Clerk con impoerp.com. */
export function clerkSatelliteConfigured() {
  return (
    envTruthy(process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE) &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_DOMAIN?.trim())
  );
}

/**
 * Clerk listo en runtime: en prod exige satélite configurado (DNS + env).
 * En dev/local alcanza con keys.
 */
export function clerkRuntimeReady() {
  if (!clerkConfigured()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return clerkSatelliteConfigured();
}

/**
 * Feature flag: Clerk UI en /login.
 * Si AUTH_CLERK_LOGIN=true pero falta satélite en prod → OTP en /login (no pantalla rota).
 */
export function clerkLoginEnabled() {
  if (!clerkRuntimeReady()) return false;
  const flag = process.env.AUTH_CLERK_LOGIN;
  if (flag === undefined || flag === "") return true;
  return envTruthy(flag);
}

/** Hosts Clerk para Content-Security-Policy (next.config). */
export const clerkCspHosts = {
  scripts: [
    "https://clerk.impoerp.com",
    "https://clerk.adsholistic.com",
    "https://*.clerk.accounts.dev",
  ],
  connect: [
    "https://clerk.impoerp.com",
    "https://clerk.adsholistic.com",
    "https://api.clerk.com",
    "https://*.clerk.accounts.dev",
  ],
  frames: [
    "https://clerk.impoerp.com",
    "https://clerk.adsholistic.com",
    "https://*.clerk.accounts.dev",
    "https://challenges.cloudflare.com",
  ],
  images: ["https://img.clerk.com"],
  fonts: ["https://fonts.gstatic.com"],
  styles: ["https://fonts.googleapis.com"],
} as const;

export const clerkRoutes = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  complete: "/auth/clerk/complete",
  afterAuth: "/overview",
} as const;
