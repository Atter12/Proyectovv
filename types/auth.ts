export type UserRole =
  | "owner"
  | "admin"
  | "advertiser"
  | "finance"
  | "viewer"
  | "support";

export type ProfileStatus = "email_pending" | "active" | "suspended";

export type OnboardingStatus =
  | "email_verification_pending"
  | "organization_pending"
  | "completed";

export type MembershipStatus = "active" | "invited" | "removed";

export type Permission =
  | "dashboard:read"
  | "wallet:read"
  | "wallet:deposit"
  | "payments:read"
  | "payments:create"
  | "adAccounts:read"
  | "adAccounts:create"
  | "campaigns:read"
  | "campaigns:create"
  | "affiliates:read"
  | "creativeAnalyzer:read"
  | "creativeAnalyzer:create"
  | "support:read"
  | "support:create"
  | "notifications:read"
  | "settings:read"
  | "settings:update";

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
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: ProfileStatus;
  email_verified: boolean;
  onboarding_status: OnboardingStatus;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string | null;
  website_url: string | null;
  logo_url: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  status: MembershipStatus;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  organizations?: OrganizationRow | OrganizationRow[] | null;
}

export interface WalletRow {
  id: string;
  organization_id: string;
  name: string;
  balance_cents: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}
