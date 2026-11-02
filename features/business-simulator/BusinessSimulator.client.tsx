"use client";
import { CreditReview } from "./CreditReview.client";

export function BusinessSimulator() {
  return <div className="space-y-6 text-[var(--auth-text)]">
    <header><h1 className="text-2xl font-semibold tracking-tight">Decisiones por cliente</h1><p className="mt-2 text-sm text-[var(--auth-text-muted)]">Evalúa una rebaja de FEE o un crédito y su impacto en Holistic.</p></header>
    <CreditReview />
  </div>;
}
