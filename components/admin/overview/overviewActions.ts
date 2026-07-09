const PAYMENT_REVIEW_STATUSES = new Set(["created", "requires_payment", "processing"]);

export function paymentOverviewActionLabel(status: string): "Revisar" | "Ver" {
  return PAYMENT_REVIEW_STATUSES.has(status) ? "Revisar" : "Ver";
}

export function paymentOverviewActionClass(status: string): string {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-normal transition duration-150 ease-out";

  if (PAYMENT_REVIEW_STATUSES.has(status)) {
    return `${base} border border-[#e8d9b0]/80 bg-[#faf5eb] text-[#8a6d2e] hover:border-[#d9c48a] hover:bg-[#f5f0e4]`;
  }

  return `${base} border border-[var(--admin-content-border)] bg-white/90 text-[#3d8fa8] hover:border-[#b8e8d4] hover:bg-[#f7fcfa]`;
}
