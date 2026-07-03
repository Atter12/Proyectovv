import type { Permission, UserRole } from "@/types/auth";

const ALL_PERMISSIONS: Permission[] = [
  "wallet:read",
  "wallet:deposit",
  "payments:read",
  "adAccounts:read",
  "adAccounts:create",
  "affiliates:read",
  "creativeAnalyzer:read",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: ["wallet:read", "payments:read", "affiliates:read", "creativeAnalyzer:read"],
  advertiser: [
    "wallet:read",
    "wallet:deposit",
    "payments:read",
    "adAccounts:read",
    "adAccounts:create",
    "affiliates:read",
    "creativeAnalyzer:read",
  ],
  admin: ALL_PERMISSIONS,
  support: [
    "wallet:read",
    "payments:read",
    "adAccounts:read",
    "affiliates:read",
    "creativeAnalyzer:read",
  ],
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  permissions: Permission[],
  required: Permission,
): boolean {
  return permissions.includes(required);
}

export function hasRole(userRole: UserRole, allowed: UserRole | UserRole[]): boolean {
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  return allowedRoles.includes(userRole);
}
