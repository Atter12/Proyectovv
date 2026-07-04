export type UserRole =
  | "owner"
  | "admin"
  | "advertiser"
  | "finance"
  | "viewer"
  | "support";

export type ProfileStatus = "email_pending" | "active" | "suspended";

export type MembershipStatus = "active" | "invited" | "removed";

export type Permission =
  | "wallet:read"
  | "wallet:deposit"
  | "payments:read"
  | "adAccounts:read"
  | "adAccounts:create"
  | "affiliates:read"
  | "creativeAnalyzer:read";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  role: UserRole;
  permissions: Permission[];
  companyId: string;
  organizationId: string;
  organizationName: string;
  emailConfirmed: boolean;
  profileStatus: ProfileStatus;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  avatar_initials: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  status: MembershipStatus;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  organizations?: OrganizationRow | OrganizationRow[] | null;
}

export interface WalletRow {
  id: string;
  organization_id: string;
  name: string;
  balance: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}
