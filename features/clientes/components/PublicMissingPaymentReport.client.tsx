"use client";

import { useMemo } from "react";
import { MissingCobroClaimPanel } from "@/features/clientes/components/MissingCobroClaimPanel.client";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

export function PublicMissingPaymentReport({
  apiBase,
  month,
  claims,
}: {
  apiBase: string;
  month: string;
  claims: ManualPaymentIntentItem[];
}) {
  const periodos = useMemo(
    () => (month && /^\d{4}-\d{2}$/.test(month) ? [month] : listRecentPeriodos(1)),
    [month],
  );
  const endpoints = useMemo(
    () => ({
      claims: `${apiBase}/missing-cobro`,
      proof: (id: string) => `${apiBase}/proof/${id}`,
    }),
    [apiBase],
  );

  return (
    <details className="mt-5 min-w-0 border-t border-[var(--admin-border)] pt-2">
      <summary className="cursor-pointer rounded-lg py-3 text-sm font-semibold text-[var(--admin-text)] marker:text-[var(--admin-text-muted)] hover:text-[var(--admin-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-surface)]">
        Ya pagué y no aparece
      </summary>
      <div className="min-w-0 pb-2 pt-1">
        <MissingCobroClaimPanel
          presentation="portal"
          periodos={periodos}
          initialClaims={claims}
          endpoints={endpoints}
        />
      </div>
    </details>
  );
}
