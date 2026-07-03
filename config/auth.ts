import { routes } from "@/config/routes";

/** Rutas que requieren sesión válida (middleware + guards). */
export const protectedRoutes = [
  routes.overview,
  routes.adAccounts,
  routes.payments,
  routes.affiliates,
  routes.creativeAnalyzer,
] as const;

/** Rutas solo para usuarios sin sesión (redirigen al dashboard si ya hay sesión). */
export const authRoutes = [routes.login] as const;

export const SESSION_COOKIE_NAME = "dm_session";

/** Duración de sesión mock: 7 días. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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
