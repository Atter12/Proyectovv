const PAYMENT_REVIEW_STATUSES = new Set(["created", "requires_payment", "processing"]);

export function paymentOverviewActionLabel(status: string): "Revisar" | "Ver" {
  return PAYMENT_REVIEW_STATUSES.has(status) ? "Revisar" : "Ver";
}

export function paymentOverviewActionClass(status: string): string {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-normal transition";

  if (PAYMENT_REVIEW_STATUSES.has(status)) {
    return `${base} border border-[#f4c95d]/50 bg-[#fff8e8] text-[#8a6010] hover:border-[#f4c95d] hover:bg-[#fff3d4]`;
  }

  return `${base} border border-[#cfe8ee] bg-white/80 text-[#0e7490] hover:border-[#74d3b4] hover:bg-[#effff7]`;
}
