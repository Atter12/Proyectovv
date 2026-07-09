const PAYMENT_REVIEW_STATUSES = new Set(["created", "requires_payment", "processing"]);

export function paymentOverviewActionLabel(status: string): "Revisar" | "Ver" {
  return PAYMENT_REVIEW_STATUSES.has(status) ? "Revisar" : "Ver";
}

export function paymentOverviewActionClass(status: string): string {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition duration-150 ease-out";

  if (PAYMENT_REVIEW_STATUSES.has(status)) {
    return `${base} border border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100`;
  }

  return `${base} border border-slate-200 bg-white text-[#178BFF] hover:border-[#178BFF]/30 hover:bg-[#EAF4FF]`;
}
