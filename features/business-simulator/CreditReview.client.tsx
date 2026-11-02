"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditBehavior, type Snapshot } from "./CreditBehavior.client";
import { ClientImpact, type FeeReference } from "./ClientImpact.client";
import { CreditProposal } from "./CreditProposal.client";
import styles from "./Simulator.module.css";

export function CreditReview() {
  const [mode, setMode] = useState<"fee" | "credit">("credit");
  const [feeReference, setFeeReference] = useState<FeeReference | null>(null);
  const [evaluationRevision, setEvaluationRevision] = useState(0);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [listBusy, setListBusy] = useState(true);
  const [listAttempt, setListAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [currency, setCurrency] = useState<"USD" | "PEN">("USD");
  const [notice, setNotice] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const client = clients.find((item) => item.id === clientId);
  const showPicker = pickerOpen || !client;
  const matchingClients = clients.filter((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/clientes", { signal: controller.signal }),
      fetch("/api/clientes/seleccionar", { signal: controller.signal }),
    ]).then(async ([list, selected]) => {
      if (!list.ok) throw new Error("No se pudieron cargar los clientes. Vuelve a intentarlo.");
      const data = await list.json();
      if (!data.ok || !Array.isArray(data.clients)) throw new Error("No se pudieron cargar los clientes.");
      const selection = selected.ok ? await selected.json() : null;
      if (!controller.signal.aborted) { setClients(data.clients); setClientId(selection?.selected?.id ?? ""); }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Error al cargar clientes.");
    }).finally(() => { if (!controller.signal.aborted) setListBusy(false); });
    return () => controller.abort();
  }, [listAttempt]);

  useEffect(() => { if (pickerOpen) searchInput.current?.focus(); }, [pickerOpen]);
  const clearEvaluation = useCallback(() => {
    setSnapshot(null); setFeeReference(null); setEvaluationRevision((n) => n + 1); setNotice(""); setError("");
  }, []);
  const evaluate = useCallback(async () => {
    if (!client) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]);
    clearEvaluation(); setBusy(true);
    try {
      const selected = await fetch("/api/clientes/seleccionar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId: client.id }), signal });
      if (!selected.ok) throw new Error("No se pudo seleccionar el cliente. Vuelve a intentarlo.");
      const read = async (url: string) => {
        const response = await fetch(url, { cache: "no-store", signal });
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("La sesión venció. Inicia sesión nuevamente.");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo consultar la información.");
        return data;
      };
      const [profit, fee] = await Promise.allSettled([read("/api/profit"), read("/api/simulator/client-fee")]);
      if (controller.signal.aborted) return;
      const notices: string[] = [];
      if (fee.status === "fulfilled" && fee.value.hecomClienteId === client.id) setFeeReference(fee.value);
      else notices.push("El fee actual no está disponible. Puedes ingresar una referencia manual.");
      if (profit.status === "fulfilled" && profit.value.cliente?.id === client.id && profit.value.analysis) setSnapshot(profit.value);
      else notices.push("No se pudo cargar el contexto de Profit. Puedes reintentar la consulta.");
      setNotice(notices.join(" "));
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo consultar el cliente."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [client, clearEvaluation]);
  useEffect(() => {
    if (!client) return;
    const timer = setTimeout(() => { void evaluate(); }, 150);
    return () => { clearTimeout(timer); activeRequest.current?.abort(); };
  }, [client, evaluate]);

  return <section aria-label="Evaluación del cliente">
    <div className={styles.clientSection}>
      <div className={styles.clientBar}>
        <div className={styles.clientIdentity}>
          <div><span className={styles.caption}>Cliente de la simulación</span><h2>{client?.name ?? "¿A quién evaluamos?"}</h2></div>
          {client && <button type="button" className={styles.textButton} onClick={() => { setPickerOpen(!pickerOpen); setSearch(""); }}>{pickerOpen ? "Cerrar búsqueda" : "Cambiar cliente"}</button>}
        </div>
        {client && <div className={styles.clientOptions}>
          <label className={styles.currency}>Simular en<select value={currency} disabled={busy} onChange={(e) => { setCurrency(e.target.value as "USD" | "PEN"); setEvaluationRevision((n) => n + 1); }}><option value="USD">Dólares · USD</option><option value="PEN">Soles · PEN</option></select></label>
          <button type="button" className={styles.textButton} disabled={busy} onClick={evaluate}>Actualizar datos</button>
        </div>}
      </div>
      {showPicker && <div className={styles.picker}>
        <label htmlFor="simulator-client-search">Busca por nombre</label>
        <input ref={searchInput} id="simulator-client-search" type="search" autoComplete="off" placeholder="Escribe el nombre de un cliente…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${styles.control} ${styles.search}`} aria-controls="simulator-client-list" disabled={listBusy}/>
        {listBusy ? <p role="status" className={styles.loading}><span className={styles.spinner} aria-hidden="true"/>Cargando clientes…</p> : <div id="simulator-client-list" className={styles.clientList} aria-label="Clientes disponibles">
          {matchingClients.map((item) => <button key={item.id} type="button" onClick={() => { if (item.id !== clientId) { activeRequest.current?.abort(); clearEvaluation(); setBusy(true); setClientId(item.id); } setPickerOpen(false); setSearch(""); }}><strong>{item.name}</strong><span>{item.id === clientId ? "Seleccionado" : "Elegir"}</span></button>)}
          {!matchingClients.length && <p className={styles.intro}>{clients.length ? "No encontramos ese nombre. Prueba con otro." : "No hay clientes disponibles para esta cuenta."}</p>}
        </div>}
      </div>}
      {error && <div role="alert" className={styles.notice}>{error} <button type="button" className={styles.textButton} onClick={() => { if (client) void evaluate(); else { setError(""); setListBusy(true); setListAttempt((n) => n + 1); } }}>Reintentar</button></div>}
    </div>
    {!client ? <div className={styles.empty}><h3>Una decisión, con los números claros.</h3><p>Elige un cliente. Podrás comparar su fee o calcular cuánto debe devolver por un crédito.</p></div> : <div hidden={showPicker}>
      {busy ? <div role="status" className={styles.loading}><span className={styles.spinner} aria-hidden="true"/><div>Consultando los datos de {client.name}<span className={styles.caption}>Reuniendo fee actual, anuncios e historial disponible.</span></div></div> : <>
        <div className={styles.modes} aria-label="Qué quieres simular">
          <button type="button" aria-pressed={mode === "credit"} className={styles.mode} onClick={() => setMode("credit")}><strong>Simular crédito</strong><span>Monto, comisión y devolución</span></button>
          <button type="button" aria-pressed={mode === "fee"} className={styles.mode} onClick={() => setMode("fee")}><strong>Cambiar fee</strong><span>Compara el ingreso para Holistic</span></button>
        </div>
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        <div className={notice ? "mt-6" : undefined}>
          <div hidden={mode !== "credit"}><CreditProposal key={`${clientId}:${currency}:${evaluationRevision}`} clientId={clientId} clientName={client.name} currency={currency} feeReference={feeReference}/></div>
          <div hidden={mode !== "fee"}><ClientImpact key={`${clientId}:${currency}:${evaluationRevision}`} clientId={clientId} clientName={client.name} snapshot={snapshot} feeReference={feeReference} currency={currency}/></div>
        </div>
        {snapshot && <details className={`${styles.disclosure} ${styles.context}`}><summary>Consultar historial y score de riesgo del cliente</summary><div className="mt-4"><CreditBehavior snapshot={snapshot} busy={false}/></div></details>}
      </>}
    </div>}
  </section>;
}
