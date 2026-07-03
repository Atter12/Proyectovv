export type UserRole = "user" | "advertiser" | "admin" | "support";

export type Permission =
  | "wallet:read"
  | "wallet:deposit"
  | "payments:read"
  | "adAccounts:read"
  | "adAccounts:create"
  | "affiliates:read"
  | "creativeAnalyzer:read";

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  avatarInitials: string;
  companyId: string;
  iat: number;
  exp: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  role: UserRole;
  permissions: Permission[];
  companyId: string;
}
