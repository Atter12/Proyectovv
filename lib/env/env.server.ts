type AuthMode = "mock" | "oauth";

function resolveSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    "dev-mock-session-secret-change-in-production"
  );
}

/**
 * Valida secretos obligatorios en runtime de producción (no durante next build).
 */
export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.SESSION_SECRET) {
    throw new Error(
      "[env] La variable SESSION_SECRET es obligatoria en producción.",
    );
  }
}

const isProduction = process.env.NODE_ENV === "production";

export const serverEnv = {
  /** mock = sesión simulada; oauth = Google OAuth (futuro). */
  authMode: (process.env.AUTH_MODE ?? "mock") as AuthMode,

  get sessionSecret(): string {
    return resolveSessionSecret();
  },

  /** URL base del backend privado (futuro). */
  apiBaseUrl: process.env.API_BASE_URL ?? "",

  /** Clave de API del backend (futuro, solo servidor). */
  apiKey: process.env.API_KEY ?? "",

  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction,
} as const;
