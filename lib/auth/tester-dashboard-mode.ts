/** Solo esta cuenta puede alternar el panel entre gerente y cliente. */
const TESTER_DASHBOARD_MODE_EMAILS = ["sandrowonmer@gmail.com"] as const;

export type TesterDashboardMode = "cliente" | "gerente";

export const TESTER_DASHBOARD_MODE_COOKIE = "vv_tester_dashboard_mode";

export function canSwitchTesterDashboardMode(
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  return (TESTER_DASHBOARD_MODE_EMAILS as readonly string[]).includes(
    normalized,
  );
}

export function parseTesterDashboardMode(
  value: string | null | undefined,
): TesterDashboardMode {
  return value === "gerente" ? "gerente" : "cliente";
}
