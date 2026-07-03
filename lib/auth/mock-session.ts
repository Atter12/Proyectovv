import { userMock } from "@/mocks/user.mock";
import { SESSION_MAX_AGE_SECONDS } from "@/config/auth";
import { getPermissionsForRole } from "@/lib/auth/permissions";
import type { SessionPayload, UserRole } from "@/types/auth";

const MOCK_COMPANY_ID = "company-default-media";
const MOCK_ROLE: UserRole = "advertiser";

export function createMockSessionPayload(): SessionPayload {
  const now = Math.floor(Date.now() / 1000);

  return {
    sub: userMock.id,
    email: userMock.email,
    name: userMock.name,
    role: MOCK_ROLE,
    permissions: getPermissionsForRole(MOCK_ROLE),
    avatarInitials: userMock.avatarInitials,
    companyId: MOCK_COMPANY_ID,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
}
