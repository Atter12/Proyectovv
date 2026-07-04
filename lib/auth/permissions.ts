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

const READ_PERMISSIONS: Permission[] = [
  "wallet:read",
  "payments:read",
  "adAccounts:read",
  "affiliates:read",
  "creativeAnalyzer:read",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  advertiser: [
    "wallet:read",
    "wallet:deposit",
    "payments:read",
    "adAccounts:read",
    "adAccounts:create",
    "affiliates:read",
    "creativeAnalyzer:read",
  ],
  finance: ["wallet:read", "wallet:deposit", "payments:read"],
  viewer: READ_PERMISSIONS,
  support: READ_PERMISSIONS,
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? READ_PERMISSIONS;
}

export function hasPermission(
  permissions: Permission[],
  required: Permission,
): boolean {
  return permissions.includes(required);
}

export function hasRole(
  userRole: UserRole,
  allowed: UserRole | UserRole[],
): boolean {
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  return allowedRoles.includes(userRole);
}
