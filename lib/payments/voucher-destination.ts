export type VoucherDestination = { holder: string; accountNumber: string; cci?: string };

function account(value: unknown): string | null {
  if (typeof value !== "string" || !/^[\d\s-]+$/.test(value)) return null;
  const digits = value.replace(/[\s-]/g, "");
  return digits.length >= 8 ? digits : null;
}

function holder(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "")
    : "";
}

/** Both visible fields must match the same configured destination, never a suffix. */
export function matchesVoucherDestination(number: unknown, name: unknown, accounts: VoucherDestination[]): boolean {
  const detected = account(number);
  const recipient = holder(name);
  return detected !== null && recipient.length > 0 && accounts.some((destination) =>
    recipient === holder(destination.holder) &&
    (detected === account(destination.accountNumber) || detected === account(destination.cci)),
  );
}
