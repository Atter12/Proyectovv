export const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  authMode: process.env.NEXT_PUBLIC_AUTH_MODE ?? "mock",
} as const;
