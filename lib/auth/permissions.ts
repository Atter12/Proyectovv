import type { Permission, UserRole } from "@/types/auth";

const ALL_PERMISSIONS: Permission[] = [
  "dashboard:read",
  "wallet:read",
  "wallet:deposit",
  "payments:read",
  "payments:create",
  "adAccounts:read",
  "adAccounts:create",
  "campaigns:read",
  "campaigns:create",
  "affiliates:read",
  "creativeAnalyzer:read",
  "creativeAnalyzer:create",
  "support:read",
  "support:create",
  "notifications:read",
  "settings:read",
  "settings:update",
];

const READ_PERMISSIONS: Permission[] = [
  "dashboard:read",
  "wallet:read",
  "payments:read",
  "adAccounts:read",
  "campaigns:read",
  "affiliates:read",
  "creativeAnalyzer:read",
  "support:read",
  "notifications:read",
  "settings:read",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  advertiser: [
    "dashboard:read",
    "wallet:read",
    "wallet:deposit",
    "payments:read",
    "payments:create",
    "adAccounts:read",
    "adAccounts:create",
    "campaigns:read",
    "affiliates:read",
    "creativeAnalyzer:read",
    "creativeAnalyzer:create",
    "support:read",
    "support:create",
    "notifications:read",
    "settings:read",
  ],
  finance: [
    "dashboard:read",
    "wallet:read",
    "wallet:deposit",
    "payments:read",
    "payments:create",
    "support:read",
    "notifications:read",
    "settings:read",
  ],
  viewer: READ_PERMISSIONS,
  support: [...READ_PERMISSIONS, "support:create"],
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
