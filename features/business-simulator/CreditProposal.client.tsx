"use client";
import { useEffect, useRef, useState } from "react";
import { creditRepayment, type CreditAssessment, type CreditTerms } from "@/lib/business-simulator/credit-proposal";
import type { FeeReference } from "./ClientImpact.client";
import styles from "./Simulator.module.css";

function value(raw:string,factor:number,max:number){if(!/^\d+(\.\d{1,2})?$/.test(raw))return null;const n=Number(raw)*factor;return Number(raw)<=max&&Number.isSafeInteger(Math.round(n))&&Math.abs(n-Math.round(n))<0.0001?Math.round(n):null;}
export function CreditProposal({clientId,clientName,currency,feeReference}:{clientId:string;clientName:string;currency:"USD"|"PEN";feeReference:FeeReference|null}){
  const [amount,setAmount]=useState("");const [fee,setFee]=useState<string|null>(null);const [days,setDays]=useState("7");
  const [assessment,setAssessment]=useState<{key:string;data:CreditAssessment}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const controller=useRef<AbortController|null>(null);useEffect(()=>()=>controller.current?.abort(),[]);
  const feeRaw=fee??(feeReference?.feeHolisticPercent!=null?String(feeReference.feeHolisticPercent):"");
  const principal=value(amount,100,1_000_000_000),bps=value(feeRaw,100,100),term=value(days,1,3650);
  const terms:CreditTerms|null=principal!==null&&principal>0&&bps!==null&&term!==null&&term>0?{principalCents:principal,feeBps:bps,days:term,currency}:null;
  const repayment=terms?creditRepayment(terms):null;const key=JSON.stringify({clientId,terms});const current=assessment?.key===key?assessment.data:null;
  const money=(n:number)=>new Intl.NumberFormat("es-PE",{style:"currency",currency}).format(n/100);
  const invalidAmount=amount!==""&&(principal===null||principal<=0),invalidFee=feeRaw!==""&&bps===null,invalidDays=days!==""&&(term===null||term<=0);
  async function evaluate(){if(!terms)return;setBusy(true);setError("");setAssessment(null);const c=new AbortController();controller.current=c;
    try{const response=await fetch("/api/simulator/credit-analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId,...terms}),signal:AbortSignal.any([c.signal,AbortSignal.timeout(120000)])});if(!response.headers.get("content-type")?.includes("application/json"))throw Error("Vuelve a iniciar sesión para evaluar.");const data=await response.json();if(!response.ok)throw Error(data.error||"No se pudo evaluar. Reintenta.");if(data.clientId!==clientId)throw Error("Cambió el cliente. Vuelve a cargarlo.");if(!c.signal.aborted)setAssessment({key,data});}catch(cause){if(!c.signal.aborted)setError(cause instanceof Error?cause.message:"No se pudo evaluar.");}finally{if(!c.signal.aborted)setBusy(false);}}
  function download(){if(!repayment||!current)return;const text=[`Evaluación de crédito · ${clientName}`,`Moneda: ${currency}`,`Crédito: ${money(repayment.principalCents)}`,`FEE: ${repayment.feeBps/100}% = ${money(repayment.feeCents)}`,`Devolución: ${money(repayment.totalDueCents)} al finalizar ${repayment.days} días. Un ciclo, sin renovación automática.`,"",current.headline,...current.signals.map(s=>`${s.label}: ${s.value}`),"",current.aiSummary?`Resumen del agente IA:\n${current.aiSummary}`:"", "Pendiente de verificar:",...current.pending,"","Fuentes:",...current.sources,`Consultado: ${current.checkedAt}`,"Decisión pendiente de gerencia. No se desembolsó dinero."].join("\n");const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="evaluacion-credito.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section aria-label="Propuesta de crédito">
    <div className={styles.workspace}>
      <div className={styles.form}>
        <h2>¿Cuánto crédito quieres simular?</h2>
        <p className={styles.intro}>Ingresa el monto. Verás la comisión y el total a devolver.</p>
        <fieldset disabled={busy} className={styles.fields}>
          <legend className="sr-only">Condiciones del crédito para {clientName}</legend>
          <label className={styles.field}>Monto del crédito ({currency})
            <input type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" placeholder="Ej. 1000" value={amount} onChange={e=>setAmount(e.target.value)} aria-invalid={invalidAmount} aria-describedby="credit-amount-help" className={styles.control}/>
            <span id="credit-amount-help" className={invalidAmount?styles.fieldError:styles.fieldHint}>{invalidAmount?"Ingresa un monto mayor que 0, con hasta 2 decimales.":"Capital que se prestaría al cliente para sus anuncios."}</span>
          </label>
          <div className={styles.pair}>
            <label className={styles.field}>Comisión de Holistic · fee (%)
              <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={feeRaw} onChange={e=>setFee(e.target.value)} aria-invalid={invalidFee} aria-describedby="credit-fee-help" className={styles.control}/>
              <span id="credit-fee-help" className={invalidFee?styles.fieldError:styles.fieldHint}>{invalidFee?"Usa un porcentaje de 0 a 100.":fee===null&&feeReference?.feeHolisticPercent!=null?"Usamos el fee actual. Puedes cambiarlo aquí.":"Se cobra una sola vez sobre el crédito."}</span>
            </label>
            <div>
              <label className={styles.field}>Devolución en (días)
                <input type="number" min="1" max="3650" step="1" inputMode="numeric" value={days} onChange={e=>setDays(e.target.value)} aria-invalid={invalidDays} aria-describedby={invalidDays?"credit-days-error":undefined} className={styles.control}/>
                {invalidDays&&<span id="credit-days-error" className={styles.fieldError}>Usa un número entero de 1 a 3650.</span>}
              </label>
              <div className={styles.presets} aria-label="Plazos frecuentes">{[7,15,30].map(day=><button key={day} type="button" aria-pressed={days===String(day)} onClick={()=>setDays(String(day))}>{day} días</button>)}</div>
            </div>
          </div>
        </fieldset>
        {feeReference?.warnings?.length ? <details className={styles.disclosure}><summary>Revisar de dónde sale el fee actual</summary><ul>{feeReference.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>:null}
        <div className={styles.action}>
          <button type="button" onClick={evaluate} disabled={!terms||busy} className={styles.primary}>{busy?"Consultando historial…":current?"Actualizar análisis del cliente":"Analizar cliente con IA"}</button>
          <p className={styles.fieldHint}>Consulta su historial para valorar esta propuesta.</p>
        </div>
        {error&&<p role="alert" className={styles.notice}>{error}</p>}
      </div>
      <aside aria-live="polite" aria-label="Resultado de la simulación de crédito" className={styles.result}>
        <div className={styles.resultHeader}><h3>Así se devuelve el crédito</h3><span>{currency}</span></div>
        {repayment?<>
          <dl className={styles.breakdown}>
            <div><dt>Capital para el cliente</dt><dd>{money(repayment.principalCents)}</dd></div>
            <div><dt>Comisión de Holistic ({repayment.feeBps/100}%)</dt><dd>+ {money(repayment.feeCents)}</dd></div>
            <div className={styles.total}><dt>Total a devolver</dt><dd>{money(repayment.totalDueCents)}</dd></div>
          </dl>
          <p className={styles.resultNote}>El cliente devolvería <strong>{money(repayment.totalDueCents)}</strong> al finalizar <strong>{repayment.days} días</strong>. De ese total, {money(repayment.feeCents)} corresponden al fee de Holistic.</p>
        </>:<p className={styles.resultEmpty}>Completa el monto{bps===null?", el fee":""}{term===null||term<=0?" y el plazo":""} para ver el capital, la comisión y la devolución total.</p>}
        <p className={styles.resultFootnote}>Un solo ciclo, sin renovación automática. Este cálculo no acredita ni desembolsa dinero.</p>
      </aside>
    </div>
    {busy&&<div role="status" className={styles.loading}><span className={styles.spinner} aria-hidden="true"/><div>Preparando el análisis del cliente<span className={styles.caption}>Consultando pagos, anuncios, ventas y costos disponibles.</span></div></div>}
    {current&&<section className={styles.assessment} aria-label="Evaluación automática">
      <div className={styles.assessmentHeader}>
        <div><h2>{current.headline}</h2><p className={styles.fieldHint}>Consulta del {new Date(current.checkedAt).toLocaleString("es-PE")}</p><p className={styles.resultNote}>Propuesta evaluada para {clientName}: <strong>{money(current.terms.principalCents)}</strong> de capital · fee {current.terms.feeBps / 100}% · {current.terms.days} días · devolución total <strong>{money(current.totalDueCents)}</strong>.</p></div>
        <button type="button" onClick={download} className={styles.secondary}>Descargar evaluación</button>
      </div>
      {current.aiSummary&&<p className={styles.aiSummary}>{current.aiSummary}</p>}
      {current.aiNotice&&<p role="status" className={styles.notice}>{current.aiNotice}</p>}
      <dl className={styles.signals}>{current.signals.map(s=><div key={s.label}><dt>{s.label}{s.tone==="attention"?" · revisar":""}</dt><dd>{s.value}</dd></div>)}</dl>
      {current.pending.length>0&&<div className={styles.pending}><h3>Antes de decidir, falta confirmar</h3><ul>{current.pending.map(p=><li key={p}>{p}</li>)}</ul></div>}
      <details className={styles.disclosure}><summary>Ver fuentes y alcance del análisis</summary><ul>{current.sources.map(s=><li key={s}>{s}</li>)}</ul></details>
      <p className={styles.resultFootnote}>La decisión corresponde a gerencia. El análisis no aprueba el crédito ni garantiza su devolución.</p>
    </section>}
  </section>;
}
