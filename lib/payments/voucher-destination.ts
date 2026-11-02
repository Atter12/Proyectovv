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

function matchesHolder(recipient: string, configured: string): boolean {
  const expected = holder(configured);
  // Abreviatura bancaria confirmada por el titular; no aceptar prefijos genéricos.
  return recipient === expected || (
    expected === "HOLISTICMARKETINGPEEIRL" && recipient === "HOLISTICMARKETINGPEE"
  );
}

/** Full account/CCI and exact holder or approved alias must match the same destination. */
export function matchesVoucherDestination(number: unknown, name: unknown, accounts: VoucherDestination[]): boolean {
  const detected = account(number);
  const recipient = holder(name);
  return detected !== null && recipient.length > 0 && accounts.some((destination) =>
    matchesHolder(recipient, destination.holder) &&
    (detected === account(destination.accountNumber) || detected === account(destination.cci)),
  );
}
