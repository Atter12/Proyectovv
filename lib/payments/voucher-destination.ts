export type VoucherDestination = { holder: string; holderAliases?: string[]; accountNumber: string; cci?: string };

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

function matchesAccount(value: unknown, destination: VoucherDestination): boolean {
  const full = account(value);
  if (full !== null) return full === account(destination.accountNumber) || full === account(destination.cci);
  if (typeof value !== "string") return false;
  const compact = value.replace(/[\s-]/g, "");
  // Only explicit masking, not an arbitrary short number or unreadable OCR.
  const masked = /^(\d*)[*xX•●]+(\d{4,})$/.exec(compact);
  const configured = account(destination.accountNumber);
  if (!masked || !configured) return false;
  const [, prefix, suffix] = masked;
  return prefix.length + suffix.length < configured.length && configured.startsWith(prefix) && configured.endsWith(suffix);
}

/** Explicitly masked normal accounts need a unique destination AND its configured recipient. */
export function matchesVoucherDestination(number: unknown, name: unknown, accounts: VoucherDestination[]): boolean {
  const recipient = holder(name);
  const candidates = accounts.filter(destination => matchesAccount(number, destination));
  if (!recipient || candidates.length !== 1) return false;
  const destination = candidates[0];
  return [destination.holder, ...(destination.holderAliases ?? [])].some(alias => holder(alias) === recipient);
}
