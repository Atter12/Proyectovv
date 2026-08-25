/** Clerk helpers for Holistic / Proyectovv auth */

export function clerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

/** Feature flag: prefer Clerk UI for /login when keys exist. */
export function clerkLoginEnabled() {
  if (!clerkConfigured()) return false;
  const flag = process.env.AUTH_CLERK_LOGIN;
  if (flag === undefined || flag === "") return true;
  return ["1", "true", "yes", "on"].includes(flag.toLowerCase());
}

export const clerkRoutes = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  complete: "/auth/clerk/complete",
  afterAuth: "/overview",
} as const;
