"use client";
import { useState } from "react";
import { feeImpact, creditImpact } from "@/lib/business-simulator/client-impact";
import type { Snapshot } from "./CreditBehavior.client";

export type FeeReference = {
  feeHolisticPercent: number | null; feeSource: string; hecomClienteId: string;
  warnings?: string[]; checkedAt?: string; verifiedPayments?: number;
  history?: { paymentId: string; date: string; feePercent: number; source: string; paidCents: number; paidCurrency: string; creditUsdCents: number; grossUsdCents: number; fxRate: number | null; surchargePercent: number }[];
};
const control = "mt-2 min-h-11 w-full rounded-lg border border-[var(--auth-border)] bg-[var(--auth-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--auth-accent)]";
const button = "min-h-11 rounded-lg border border-[var(--auth-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--auth-surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--auth-accent)]";
function parse(raw: string, factor = 100, max = 1_000_000_000) {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  return value <= max && Number.isSafeInteger(Math.round(value * factor)) && Math.abs(value * factor - Math.round(value * factor)) < 0.0001 ? Math.round(value * factor) : null;
}
export function ClientImpact({ snapshot, feeReference, currency, mode, requested, onRequested, clientId, clientName }: {
  snapshot: Snapshot | null; feeReference: FeeReference | null; currency: string; mode: "fee" | "credit";
  requested: number | null; onRequested: (value: number | null) => void; clientId: string; clientName: string;
}) {
  const observed = currency === "USD" && snapshot && Number.isFinite(snapshot.analysis.spendInRange) ? Math.round(snapshot.analysis.spendInRange * 100) : null;
  const [baseRaw, setBaseRaw] = useState("");
  const [currentRaw, setCurrentRaw] = useState("");
  const [newFee, setNewFee] = useState("");
  const [newBase, setNewBase] = useState("");
  const [days, setDays] = useState("");
  const [annual, setAnnual] = useState("");
  const [reason, setReason] = useState("");
  const [editBase, setEditBase] = useState(false);
  const [editFee, setEditFee] = useState(false);
  const [notice, setNotice] = useState("");
  const base = editBase ? parse(baseRaw) : observed;
  const current = editFee ? parse(currentRaw, 100, 100) : feeReference?.feeHolisticPercent != null ? Math.round(feeReference.feeHolisticPercent * 100) : null;
  const proposed = parse(newFee, 100, 100);
  const volume = newBase === "" ? base : parse(newBase);
  const term = parse(days, 1, 3650), rate = parse(annual, 100, 100);
  const fee = base !== null && current !== null && proposed !== null && volume !== null ? feeImpact(base, current, proposed, volume) : null;
  const credit = requested !== null && requested > 0 && term !== null && term > 0 && rate !== null && current !== null ? creditImpact(requested, term, rate, current) : null;
  const money = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(cents / 100);
  const valid = mode === "fee" ? fee !== null : credit !== null;
  function download() {
    const report = { version: "client-decision-v1", clientId, clientName, currency, decision: mode, reason, reference: { from: snapshot?.from, to: snapshot?.to, observedSpendCents: observed, fee: feeReference, baseIsManual: editBase, feeIsManual: editFee }, assumptions: { base, currentFeeBps: current, proposedFeeBps: proposed, proposedBase: volume, principal: requested, days: term, annualFundingBps: rate }, result: mode === "fee" ? fee : credit, risk: snapshot?.staffOps?.score ?? null, createdAt: new Date().toISOString(), status: "Evaluación gerencial; no aplicada" };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `decision-${mode}-${clientId.replace(/[^a-z0-9-]/gi, "_")}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("Evaluación exportada con cliente, motivo y supuestos.");
  }
  return <section aria-label="Impacto para Holistic" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">{mode === "fee" ? "¿Qué FEE le ofreceríamos?" : "¿Cuánto crédito le daríamos?"}</h2><p className="mt-1 text-sm text-[var(--auth-text-muted)]">Solo para {clientName} · {currency}</p></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--auth-border)] py-4"><div><p className="text-xs text-[var(--auth-text-muted)]">FEE actual {editFee ? "· manual" : feeReference?.feeSource === "payment_derived" ? "· calculado de recarga" : feeReference?.feeSource === "payment_record" ? "· aplicado en recarga" : feeReference?.feeSource === "hecom_cliente" ? "· acuerdo del cliente" : feeReference?.feeSource === "hecom_account" ? "· acuerdo de cuenta" : "· pendiente de verificar"}</p><p className="mt-1 text-lg font-semibold">{current === null ? "Sin datos" : `${current / 100}%`}</p></div><button className={button} type="button" onClick={() => { setEditFee(!editFee); setCurrentRaw(current === null ? "" : String(current / 100)); }}>{editFee ? "Usar registrado" : "Ajustar referencia"}</button></div>
      {feeReference?.warnings?.map((warning) => <p key={warning} className="text-sm leading-6 text-[var(--auth-text-muted)]">{warning}</p>)}
      {!!feeReference?.history?.length && <details className="text-sm"><summary className="cursor-pointer font-medium">Ver recargas que respaldan el FEE</summary><p className="mt-2 text-xs text-[var(--auth-text-muted)]">Hasta 100 recargas de 180 días; solo pagos confirmados con abono de cartera verificado. El porcentaje se calcula sobre el saldo acreditado.</p><ul className="mt-3 space-y-3">{feeReference.history.map((row) => <li key={row.paymentId} className="border-t border-[var(--auth-border)] pt-3 text-xs leading-6"><strong>{new Date(row.date).toLocaleDateString("es-PE")} · FEE {row.feePercent}%</strong><br/>Pago confirmado: {new Intl.NumberFormat("es-PE", { style: "currency", currency: row.paidCurrency }).format(row.paidCents / 100)} · A cartera: USD {(row.creditUsdCents / 100).toFixed(2)}{row.fxRate ? ` · Cambio: ${row.fxRate} PEN/USD` : ""}{row.surchargePercent ? ` · Pasarela excluida: ${row.surchargePercent}%` : ""}<button type="button" className="mt-2 block min-h-10 font-semibold underline underline-offset-4" onClick={() => { setEditFee(true); setCurrentRaw(String(row.feePercent)); }}>Usar {row.feePercent}% en esta simulación</button></li>)}</ul></details>}
      {(editFee || current === null) && <label className="block text-sm">FEE actual a evaluar (%)<input type="number" min="0" max="100" step="0.01" value={currentRaw} onChange={(e) => { setEditFee(true); setCurrentRaw(e.target.value); }} className={control}/></label>}
      {mode === "fee" ? <>
        <label className="block text-sm font-medium">Nuevo FEE (%)<input autoComplete="off" type="number" min="0" max="100" step="0.1" value={newFee} onChange={(e) => setNewFee(e.target.value)} placeholder="Porcentaje que quieres ofrecer" className={control}/></label>
        <div><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm">Base de comparación: <strong>{base === null ? "pendiente" : money(base)}</strong></span><button type="button" className="min-h-10 text-sm underline underline-offset-4" onClick={() => { setEditBase(!editBase); setBaseRaw(base === null ? "" : String(base / 100)); }}>{editBase ? "Usar gasto observado" : "Ajustar base"}</button></div><p className="text-xs leading-5 text-[var(--auth-text-muted)]">{editBase ? "Importe manual para el período evaluado." : snapshot && observed !== null ? `Gasto observado del ${snapshot.from} al ${snapshot.to}; se usa como base de simulación, no como FEE facturado.` : "Sin gasto compatible. Ingresa la base para evaluar."}</p></div>
        {(editBase || base === null) && <label className="block text-sm">Base publicitaria ({currency})<input type="number" min="0" step="0.01" value={baseRaw} onChange={(e) => { setEditBase(true); setBaseRaw(e.target.value); }} className={control}/></label>}
        <details><summary className="cursor-pointer text-sm font-medium">¿Esperas que este cliente invierta más?</summary><label className="mt-3 block text-sm">Volumen esperado en un período equivalente ({currency})<input type="number" min="0" step="0.01" value={newBase} onChange={(e) => setNewBase(e.target.value)} placeholder="Vacío = mismo volumen" className={control}/></label><p className="mt-2 text-xs text-[var(--auth-text-muted)]">Es una expectativa comercial, no una proyección automática.</p></details>
      </> : <>
        <label className="block text-sm font-medium">Crédito para financiar medios ({currency})<input type="number" min="0" step="0.01" value={requested === null ? "" : requested / 100} onChange={(e) => onRequested(parse(e.target.value))} className={control}/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Plazo de devolución (días)<input type="number" min="1" max="3650" step="1" value={days} onChange={(e) => setDays(e.target.value)} className={control}/></label><label className="text-sm">Costo anual de fondos (%)<input type="number" min="0" max="100" step="0.01" value={annual} onChange={(e) => setAnnual(e.target.value)} className={control}/></label></div><p className="text-xs leading-5 text-[var(--auth-text-muted)]">Costo para Holistic, no interés al cliente. Usa 0 solo si no imputarás costo de financiación.</p>
      </>}
      <label className="block text-sm">Motivo de la propuesta<textarea rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Relación estratégica, retención, mayor inversión…" className={`${control} py-3`}/></label>
    </div>
    <aside className="rounded-xl bg-[var(--auth-surface-muted)] p-5 sm:p-6" aria-live="polite">
      <h3 className="text-base font-semibold">Así afecta a Holistic</h3>
      {mode === "fee" ? fee ? <>
        <p className="mt-4 text-2xl font-semibold tabular-nums">{fee.difference >= 0 ? "+" : "−"}{money(Math.abs(fee.difference))}</p><p className="mt-1 text-sm">de FEE frente a las condiciones actuales</p>
        <dl className="mt-5 space-y-4 text-sm">{[["FEE con condiciones actuales", money(fee.current)], ["FEE con la propuesta", money(fee.proposed)], [fee.concession >= 0 ? "Rebaja al mismo volumen" : "Aumento al mismo volumen", money(Math.abs(fee.concession))], ["Volumen para conservar el FEE", fee.needed === null ? "No se recupera con FEE 0%" : money(fee.needed)]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-[var(--auth-text-muted)]">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}</dl>
        <p className="mt-5 border-t border-[var(--auth-border)] pt-4 text-sm leading-6">{fee.difference < 0 ? "La propuesta reduce el ingreso por FEE. La relación comercial o el crecimiento esperado deben justificar esa diferencia." : "La propuesta conserva o aumenta el ingreso por FEE con el volumen ingresado."}</p><p className="mt-2 text-xs leading-5 text-[var(--auth-text-muted)]">Ingreso bruto por FEE; no es utilidad neta. No descuenta costos operativos ni impuestos.</p>
      </> : <p className="mt-4 text-sm leading-6 text-[var(--auth-text-muted)]">Ingresa el nuevo FEE{current === null ? ", la tarifa actual" : ""}{base === null ? " y la base publicitaria" : ""} para comparar el ingreso de este cliente.</p> : <>
        <p className="mt-4 text-2xl font-semibold tabular-nums">{requested !== null ? money(requested) : "Monto pendiente"}</p><p className="mt-1 text-sm">capital adicional comprometido{term ? ` durante ${term} días` : ""}</p>
        {credit ? <><dl className="mt-5 space-y-4 text-sm">{[["FEE si consume todo el crédito", money(credit.fee)], ["Costo de financiar el plazo", money(credit.financing)], ["FEE menos financiación", money(credit.afterFinancing)]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-[var(--auth-text-muted)]">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}</dl><p className="mt-5 border-t border-[var(--auth-border)] pt-4 text-sm leading-6">{credit.afterFinancing <= 0 ? "El FEE no deja margen positivo tras financiar el plazo." : "El FEE cubre el costo de financiación ingresado. Falta revisar la capacidad de pago."}</p></> : <p className="mt-4 text-sm leading-6 text-[var(--auth-text-muted)]">Completa monto, plazo, FEE y costo de fondos para calcular el impacto.</p>}
        <p className="mt-3 text-xs leading-5 text-[var(--auth-text-muted)]">Supone consumo completo y devolución puntual del principal y FEE. No incluye pérdidas por impago, costos operativos ni deuda previa. El principal comprometido no es ingreso.</p>
      </>}
      <button type="button" disabled={!valid} onClick={download} className={`${button} mt-5 w-full disabled:opacity-40`}>Exportar propuesta de este cliente</button><p className="mt-3 text-xs leading-5 text-[var(--auth-text-muted)]">Evaluar no modifica su tarifa ni desembolsa crédito.</p>{notice && <p role="status" className="mt-2 text-xs">{notice}</p>}
    </aside>
  </section>;
}
