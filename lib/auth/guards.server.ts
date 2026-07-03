import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { hasPermission, hasRole } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session.server";
import type { Permission, SessionUser, UserRole } from "@/types/auth";

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect(routes.login);
  }
  return session;
}

export async function requireRole(
  allowed: UserRole | UserRole[],
): Promise<SessionUser> {
  const session = await requireSession();
  if (!hasRole(session.role, allowed)) {
    redirect(routes.overview);
  }
  return session;
}

export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const session = await requireSession();
  if (!hasPermission(session.permissions, permission)) {
    redirect(routes.overview);
  }
  return session;
}

export async function requireCompanyAccess(
  companyId: string,
): Promise<SessionUser> {
  const session = await requireSession();
  if (session.companyId !== companyId) {
    redirect(routes.overview);
  }
  return session;
}
