import { routes } from "@/config/routes";

/** Rutas que requieren sesión verificada (middleware + guards). */
export const protectedRoutes = [
  routes.overview,
  routes.adAccounts,
  routes.payments,
  routes.affiliates,
  routes.creativeAnalyzer,
] as const;

/** Rutas de auth pre-dashboard. */
export const authRoutes = [
  routes.login,
  routes.register,
  routes.verifyOtp,
] as const;

/** Rutas públicas de auth donde un usuario ya verificado no debe entrar. */
export const guestOnlyRoutes = [routes.login, routes.register] as const;

export function isProtectedPath(pathname: string): boolean {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isAuthPath(pathname: string): boolean {
  return authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isGuestOnlyPath(pathname: string): boolean {
  return guestOnlyRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isVerifyOtpPath(pathname: string): boolean {
  return (
    pathname === routes.verifyOtp ||
    pathname.startsWith(`${routes.verifyOtp}/`)
  );
}
