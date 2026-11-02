"use client";
import Link from "next/link";
import type { ClienteScore } from "@/lib/realprofit/client-score";

export type Snapshot = {
  cliente: { id: string; name: string }; from: string; to: string;
  analysis: {
    spendInRange: number; daysWithActivity: number; dataThroughDate: string | null;
    cpaCollected: number | null; hasCodLink: boolean; roasCollected: number | null;
    perf: { available: boolean; avgCpm: number | null; error: string | null; fetchedAt: string | null };
  };
  staffOps?: { score?: ClienteScore | null; walletAvailableUsd: number | null; collections?: { deposits90d: number | null; failedDeposits90d: number | null } };
};
const verdicts = { green: "Riesgo bajo", yellow: "Riesgo moderado", orange: "Riesgo alto", red: "Riesgo muy alto", no_base: "Sin base suficiente" };
const factors = { ads: "Publicidad", credit: "Uso del crédito", collections: "Depósitos", tickets: "Soporte" };
export function CreditBehavior({ snapshot, busy }: { snapshot: Snapshot | null; busy: boolean }) {
  const score = snapshot?.staffOps?.score;
  const usd = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "Sin datos" : new Intl.NumberFormat("es-PE", { style: "currency", currency: "USD" }).format(value);
  if (busy) return <div role="status" className="rounded-xl bg-[var(--auth-surface-muted)] p-6"><p className="font-semibold">Consultando el historial del cliente…</p><p className="mt-2 text-sm text-[var(--auth-text-muted)]">Reuniendo score, depósitos, anuncios y costos disponibles.</p></div>;
  if (!snapshot) return <div className="border-b border-[var(--auth-border)] px-1 py-8"><h3 className="text-lg font-semibold">Selecciona el cliente para empezar.</h3><p className="mt-2 text-sm text-[var(--auth-text-muted)]">Selecciona un cliente y pulsa Evaluar cliente para cargar su FEE, gasto y score de riesgo.</p></div>;
  return <section aria-label="Score del cliente" className="rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] p-5">
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div><h2 className="text-lg font-semibold">{snapshot.cliente.name}</h2><p className="mt-1 text-sm text-[var(--auth-text-muted)]">Score de riesgo de gerencia</p>
        <div className="mt-4 flex flex-wrap items-baseline gap-3"><strong className="text-3xl font-semibold tracking-tight tabular-nums">{score?.score ?? "—"}<span className="ml-1 text-lg font-normal text-[var(--auth-text-muted)]">/ 100</span></strong><span className="text-sm font-semibold">{verdicts[score?.verdict ?? "no_base"]}</span></div>
        <p className="mt-3 text-xs text-[var(--auth-text-muted)]">Menor score = menor riesgo. No equivale a una aprobación de crédito.</p>
        {score?.score != null && <div className="mt-4"><div className="relative h-2 overflow-hidden rounded-full bg-[var(--auth-border)]"><div style={{ width: `${score.score}%` }} className="h-full bg-[var(--auth-text)]" /></div><div className="mt-2 flex justify-between text-xs text-[var(--auth-text-muted)]"><span>0 · Bajo</span><span>30 · Moderado</span><span>60 · Alto</span><span>80 · Muy alto</span></div></div>}
      </div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-6 md:border-l md:border-[var(--auth-border)] md:pl-6">{[
        ["Depósitos confirmados · 90 días", snapshot.staffOps?.collections?.deposits90d ?? "Sin datos"],
        ["Cartera disponible", usd(snapshot.staffOps?.walletAvailableUsd)],
        ["CPA por venta cobrada", snapshot.analysis.hasCodLink ? usd(snapshot.analysis.cpaCollected) : "Sin tienda vinculada"],
        ["ROAS cobrado", snapshot.analysis.hasCodLink && snapshot.analysis.roasCollected != null ? `${snapshot.analysis.roasCollected.toFixed(2)}×` : "Sin datos"],
      ].map(([label, value]) => <div key={label}><dt className="text-xs leading-5 text-[var(--auth-text-muted)]">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>)}</dl>
    </div>
    <details className="mt-6 border-t border-[var(--auth-border)] pt-4 text-sm"><summary className="cursor-pointer font-medium">Cómo se calcula y qué datos incluye</summary>
      <p className="mt-3 text-xs leading-6 text-[var(--auth-text-muted)]">Modelo existente: publicidad 45%, uso del crédito 30%, depósitos 15% y soporte 10%. Los factores sin datos se excluyen y se redistribuyen los pesos. No mide una probabilidad de impago.</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-4">{score?.factors.map((factor) => <div key={factor.id}><dt className="text-xs text-[var(--auth-text-muted)]">{factors[factor.id]}</dt><dd className="mt-1 font-medium">{factor.points === null ? "Sin datos" : `${factor.points}/100 de salud`}</dd></div>)}</dl>
      <p className="mt-3 text-xs leading-6 text-[var(--auth-text-muted)]">Score: anuncios de 30 días, crédito y depósitos de 90 días. CPA y ROAS: {snapshot.from} a {snapshot.to}. Gasto actualizado hasta {snapshot.analysis.dataThroughDate ?? "fecha desconocida"}. Depósitos: hasta 200 movimientos del ledger; los intentos fallidos no equivalen a mora. La cartera registrada no prueba capacidad de pago.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-[var(--auth-accent)]"><Link href="/profit" className="underline underline-offset-4">Ver anuncios en Profit</Link><Link href="/payments/profit" className="underline underline-offset-4">Ver pagos y comprobantes</Link></div>
    </details>
  </section>;
}
