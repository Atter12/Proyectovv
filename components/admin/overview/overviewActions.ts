const PAYMENT_REVIEW_STATUSES = new Set(["created", "requires_payment", "processing"]);

export function paymentOverviewActionLabel(status: string): "Revisar" | "Ver" {
  return PAYMENT_REVIEW_STATUSES.has(status) ? "Revisar" : "Ver";
}

export function paymentOverviewActionClass(status: string): string {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition duration-150 ease-out";

  if (PAYMENT_REVIEW_STATUSES.has(status)) {
    return `${base} border border-[var(--admin-badge-warning-text)]/25 bg-[var(--admin-badge-warning-bg)] text-[var(--admin-badge-warning-text)] hover:opacity-90`;
  }

  return `${base} border border-[var(--admin-control-border)] bg-[var(--admin-control-bg)] text-[var(--admin-accent)] hover:border-[var(--admin-accent)]/30 hover:bg-[var(--admin-accent-soft)]`;
}
