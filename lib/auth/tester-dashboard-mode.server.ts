import "server-only";
import { cookies } from "next/headers";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import {
  canSwitchTesterDashboardMode,
  parseTesterDashboardMode,
  TESTER_DASHBOARD_MODE_COOKIE,
  type TesterDashboardMode,
} from "@/lib/auth/tester-dashboard-mode";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/** `null` si la cuenta no puede cambiar de modo. */
export async function getTesterDashboardMode(
  email: string | null | undefined,
): Promise<TesterDashboardMode | null> {
  if (!canSwitchTesterDashboardMode(email)) return null;
  const store = await cookies();
  return parseTesterDashboardMode(
    store.get(TESTER_DASHBOARD_MODE_COOKIE)?.value,
  );
}

export async function setTesterDashboardMode(
  mode: TesterDashboardMode,
): Promise<void> {
  const store = await cookies();
  store.set(TESTER_DASHBOARD_MODE_COOKIE, mode, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
}

/** Staff real, o el tester cuando eligió modo gerente. */
export async function sessionIsGerente(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  if (isHecomOtpStaffEmail(email)) return true;
  return (await getTesterDashboardMode(email)) === "gerente";
}
