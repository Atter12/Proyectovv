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

/**
 * Permissions for Holistic staff (OTP gerentes) always include allocate/fund
 * and self-serve ops on the selected cliente (ads accounts, pixels, etc.).
 * Org role can be viewer while the persona is gerente.
 */
export function getPermissionsForRole(
  role: UserRole,
  options?: { staffPayments?: boolean },
): Permission[] {
  const base = ROLE_PERMISSIONS[role] ?? READ_PERMISSIONS;
  if (!options?.staffPayments) return base;
  const extra: Permission[] = [
    "payments:read",
    "payments:create",
    "wallet:read",
    "wallet:deposit",
    "adAccounts:read",
    "adAccounts:create",
  ];
  return [...new Set([...base, ...extra])];
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
