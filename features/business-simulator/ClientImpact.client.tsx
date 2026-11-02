"use client";

import { useState } from "react";
import { feeImpact } from "@/lib/business-simulator/client-impact";
import type { Snapshot } from "./CreditBehavior.client";
import styles from "./Simulator.module.css";

export type FeeReference = {
  feeHolisticPercent: number | null; feeSource: string; hecomClienteId: string;
  warnings?: string[]; checkedAt?: string; verifiedPayments?: number;
  history?: { paymentId: string; date: string; feePercent: number; source: string; paidCents: number; paidCurrency: string; creditUsdCents: number; grossUsdCents: number; fxRate: number | null; surchargePercent: number }[];
};

function parse(raw: string, factor = 100, max = 1_000_000_000) {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  return value <= max && Number.isSafeInteger(Math.round(value * factor)) && Math.abs(value * factor - Math.round(value * factor)) < 0.0001 ? Math.round(value * factor) : null;
}

export function ClientImpact({ snapshot, feeReference, currency, clientId, clientName }: {
  snapshot: Snapshot | null; feeReference: FeeReference | null; currency: string; clientId: string; clientName: string;
}) {
  const observed = currency === "USD" && snapshot && Number.isFinite(snapshot.analysis.spendInRange) && snapshot.analysis.spendInRange >= 0
    ? Math.round(snapshot.analysis.spendInRange * 100) : null;
  const [baseRaw, setBaseRaw] = useState("");
  const [currentRaw, setCurrentRaw] = useState("");
  const [newFee, setNewFee] = useState("");
  const [newBase, setNewBase] = useState("");
  const [reason, setReason] = useState("");
  const [editBase, setEditBase] = useState(false);
  const [editFee, setEditFee] = useState(false);
  const [notice, setNotice] = useState("");
  const base = editBase ? parse(baseRaw) : observed;
  const current = editFee ? parse(currentRaw, 100, 100) : feeReference?.feeHolisticPercent != null ? Math.round(feeReference.feeHolisticPercent * 100) : null;
  const proposed = parse(newFee, 100, 100);
  const volume = newBase === "" ? base : parse(newBase);
  const fee = base !== null && current !== null && proposed !== null && volume !== null ? feeImpact(base, current, proposed, volume) : null;
  const money = (cents: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(cents / 100);
  const invalidFee = newFee !== "" && proposed === null;

  function download() {
    if (!fee) return;
    const report = { version: "client-decision-v1", clientId, clientName, currency, decision: "fee", reason,
      reference: { from: snapshot?.from, to: snapshot?.to, observedSpendCents: observed, fee: feeReference, baseIsManual: editBase, feeIsManual: editFee },
      assumptions: { base, currentFeeBps: current, proposedFeeBps: proposed, proposedBase: volume }, result: fee,
      risk: snapshot?.staffOps?.score ?? null, createdAt: new Date().toISOString(), status: "Evaluación gerencial; no aplicada" };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `decision-fee-${clientId.replace(/[^a-z0-9-]/gi, "_")}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("Propuesta descargada. La tarifa del cliente sigue igual.");
  }

  const referenceFields = <>
    <label className={styles.field}>Fee actual para comparar (%)
      <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={editFee ? currentRaw : current === null ? "" : current / 100} onChange={(e) => { setEditFee(true); setCurrentRaw(e.target.value); }} className={styles.control} aria-invalid={editFee && currentRaw !== "" && current === null}/>
      {editFee && <button type="button" className={styles.textButton} onClick={() => { setEditFee(false); setCurrentRaw(""); }}>Usar fee registrado</button>}
    </label>
    <label className={styles.field}>Inversión publicitaria del período ({currency})
      <input type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" value={editBase ? baseRaw : base === null ? "" : base / 100} onChange={(e) => { setEditBase(true); setBaseRaw(e.target.value); }} className={styles.control} aria-invalid={editBase && baseRaw !== "" && base === null}/>
      <span className={styles.fieldHint}>{currency === "PEN" ? "Ingresa una referencia en soles; el gasto en dólares no se convierte automáticamente." : "Usa un monto para el mismo período que estás comparando."}</span>
      {editBase && observed !== null && <button type="button" className={styles.textButton} onClick={() => { setEditBase(false); setBaseRaw(""); }}>Usar gasto observado</button>}
    </label>
  </>;

  return <section aria-label="Impacto para Holistic" className={styles.workspace}>
    <div className={styles.form}>
      <h2>¿Qué fee quieres ofrecer a {clientName}?</h2>
      <p className={styles.intro}>Esta propuesta es solo para este cliente. No cambia el fee general ni el de otros clientes.</p>
      <div className={styles.reference}>
        <div><span className={styles.caption}>Fee actual{editFee ? " · referencia manual" : ""}</span><strong>{current === null ? "Por completar" : `${current / 100}%`}</strong></div>
        <div><span className={styles.caption}>Inversión de referencia{editBase ? " · manual" : ""}</span><strong>{base === null ? "Por completar" : money(base)}</strong></div>
      </div>
      <div className={styles.fields}>
        <label className={styles.field}>Nuevo fee (%)
          <input autoComplete="off" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={newFee} onChange={(e) => setNewFee(e.target.value)} placeholder="Escribe el porcentaje propuesto" aria-invalid={invalidFee} aria-describedby={invalidFee ? "fee-proposal-error" : undefined} className={styles.control}/>
          {invalidFee && <span id="fee-proposal-error" className={styles.fieldError}>Ingresa un porcentaje de 0 a 100, con hasta 2 decimales.</span>}
        </label>
        {(observed === null || feeReference?.feeHolisticPercent == null) && referenceFields}
      </div>
    </div>
    <aside className={`${styles.result} ${styles.feeResult}`} aria-live="polite" aria-label="Resultado del cambio de fee">
      <div className={styles.resultHeader}><h3>Ingreso por fee de este cliente</h3><span>{currency}</span></div>
      {fee ? <>
        <dl className={styles.breakdown}>
          <div><dt>Con el fee actual ({current! / 100}%)</dt><dd>{money(fee.current)}</dd></div>
          <div><dt>Con el nuevo fee ({proposed! / 100}%)</dt><dd>{money(fee.proposed)}</dd></div>
          <div className={styles.total}><dt>{fee.difference < 0 ? "Ingresaríamos menos" : fee.difference > 0 ? "Ingresaríamos más" : "Sin diferencia"}</dt><dd>{money(Math.abs(fee.difference))}</dd></div>
        </dl>
        <p className={styles.resultNote}>{fee.needed === null ? "Con un fee de 0% no se recupera el ingreso actual aumentando la inversión." : fee.difference < 0 ? <>Para mantener el ingreso actual con este fee, el cliente tendría que invertir <strong>{money(fee.needed)}</strong> en un período equivalente.</> : "La propuesta mantiene o aumenta el ingreso por fee con la inversión ingresada."}</p>
        {newBase !== "" && <p className={styles.resultFootnote}>La propuesta usa una inversión esperada de {money(volume!)}. Al mantener la inversión actual, el fee sería {money(fee.sameVolume)}.</p>}
      </> : <p className={styles.resultEmpty}>Ingresa el nuevo fee{current === null ? ", el fee actual" : ""}{base === null ? " y la inversión de referencia" : ""} para ver la comparación.</p>}
      <p className={styles.resultFootnote}>Ingreso bruto por comisión. No descuenta costos operativos ni impuestos.</p>
      <p className={styles.resultFootnote}>Propuesta para {clientName}. Su fee registrado no cambia al simular o descargar.</p>
      <button type="button" disabled={!fee} onClick={download} className={`${styles.secondary} ${styles.action}`}>Descargar propuesta</button>
      {notice && <p role="status" className={styles.fieldHint}>{notice}</p>}
    </aside>
    <div className={styles.extras}>
      {observed !== null && feeReference?.feeHolisticPercent != null && <details className={styles.disclosure}><summary>Ajustar el fee actual o la inversión de referencia</summary><div className={styles.fields}>{referenceFields}</div></details>}
      <details className={styles.disclosure}>
        <summary>¿Esperas que el cliente invierta más?</summary>
        <label className={styles.field}>Inversión esperada en un período equivalente ({currency})<input type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" value={newBase} onChange={(e) => setNewBase(e.target.value)} placeholder="Vacío = mantener la inversión actual" className={styles.control} aria-invalid={newBase !== "" && volume === null}/></label>
        <p>Es tu expectativa comercial, no una predicción automática.</p>
      </details>
      <details className={styles.disclosure}><summary>Datos usados en esta comparación</summary>
        <p>{editBase ? "Inversión ingresada manualmente." : snapshot && observed !== null ? `Gasto observado del ${snapshot.from} al ${snapshot.to}. Se usa como referencia; no equivale a comisiones facturadas.` : "No hay gasto disponible en esta moneda. Completa la referencia manual."}</p>
        <p>{editFee ? "Fee ingresado manualmente para esta propuesta." : feeReference?.feeSource === "hecom_cliente" ? "Fee del acuerdo registrado para el cliente." : feeReference?.feeSource === "hecom_account" ? "Fee del acuerdo registrado en su cuenta." : feeReference?.feeSource?.startsWith("payment_") ? "Fee respaldado por recargas confirmadas." : "El origen del fee requiere verificación."}</p>
        {feeReference?.warnings?.map(warning => <p key={warning}>{warning}</p>)}
        {!!feeReference?.history?.length && <ul>{feeReference.history.map(row => <li key={row.paymentId}>
          <strong>{new Date(row.date).toLocaleDateString("es-PE")} · Fee {row.feePercent}%</strong><p>Pago: {new Intl.NumberFormat("es-PE", { style: "currency", currency: row.paidCurrency }).format(row.paidCents / 100)} · A cartera: USD {(row.creditUsdCents / 100).toFixed(2)}{row.fxRate ? ` · Cambio: ${row.fxRate} PEN/USD` : ""}{row.surchargePercent ? ` · Pasarela excluida: ${row.surchargePercent}%` : ""}</p>
          <button type="button" className={styles.textButton} onClick={() => { setEditFee(true); setCurrentRaw(String(row.feePercent)); }}>Usar {row.feePercent}% como referencia</button>
        </li>)}</ul>}
      </details>
      <label className={`${styles.field} ${styles.action}`}>Motivo de la propuesta <span className={styles.caption}>Opcional · se incluye al descargar</span><textarea rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Mantener al cliente a cambio de mayor inversión" className={styles.control}/></label>
    </div>
  </section>;
}
