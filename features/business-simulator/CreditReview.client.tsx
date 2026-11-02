"use client";
import { useCallback, useEffect, useState } from "react";
import { CreditBehavior, type Snapshot } from "./CreditBehavior.client";
import { ClientImpact, type FeeReference } from "./ClientImpact.client";
import { CreditProposal } from "./CreditProposal.client";
const control = "mt-2 min-h-11 w-full rounded-lg border border-[var(--auth-border)] bg-[var(--auth-surface)] px-3 text-sm focus:outline-2 focus:outline-[var(--auth-accent)]";
export function CreditReview() {
  const [mode, setMode] = useState<"fee" | "credit">("credit");
  const [feeReference, setFeeReference] = useState<FeeReference | null>(null);
  const [evaluationRevision, setEvaluationRevision] = useState(0);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [listBusy, setListBusy] = useState(true);
  const [listAttempt, setListAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [currency, setCurrency] = useState<"USD" | "PEN">("USD");
  const [notice, setNotice] = useState("");
  const client = clients.find((item) => item.id === clientId);
  const button = "min-h-11 rounded-lg border border-[var(--auth-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--auth-surface-muted)] focus-visible:outline-2 disabled:opacity-40";
  const primary = "min-h-11 rounded-lg bg-[var(--auth-text)] px-4 py-2 text-sm font-semibold text-[var(--auth-surface)] hover:opacity-85 focus-visible:outline-2 disabled:opacity-40";
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetch("/api/clientes", { signal: controller.signal }), fetch("/api/clientes/seleccionar", { signal: controller.signal })])
      .then(async ([list, selected]) => {
        if (!list.ok) throw new Error("No se pudieron cargar los clientes. Reintenta la consulta.");
        const data = await list.json();
        if (!data.ok || !Array.isArray(data.clients)) throw new Error("No se pudieron cargar los clientes.");
        const selection = selected.ok ? await selected.json() : null;
        if (!controller.signal.aborted) { setClients(data.clients); setClientId(selection?.selected?.id ?? ""); }
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Error al cargar clientes."); })
      .finally(() => { if (!controller.signal.aborted) setListBusy(false); });
    return () => controller.abort();
  }, [listAttempt]);
  const clearEvaluation = useCallback(() => {
    setSnapshot(null); setFeeReference(null); setEvaluationRevision((n) => n + 1); setNotice(""); setError("");
  }, []);
  const evaluate = useCallback(async () => {
    if (!client) return;
    clearEvaluation(); setBusy(true);
    try {
      const selected = await fetch("/api/clientes/seleccionar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId: client.id }), signal: AbortSignal.timeout(30000) });
      if (!selected.ok) throw new Error("No se pudo seleccionar el cliente. Intenta nuevamente.");
      const read = async (url: string) => {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60000) });
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("La sesión venció. Inicia sesión nuevamente.");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo consultar la información.");
        return data;
      };
      const [profit, fee] = await Promise.allSettled([read("/api/profit"), read("/api/simulator/client-fee").then((value) => { if (value.hecomClienteId === client.id) setFeeReference(value); return value; })]);
      const notices: string[] = [];
      if (fee.status === "fulfilled" && fee.value.hecomClienteId === client.id) setFeeReference(fee.value);
      else notices.push("No se pudo cargar el FEE actual. Ingresa una referencia manual.");
      if (profit.status === "fulfilled" && profit.value.cliente?.id === client.id && profit.value.analysis) setSnapshot(profit.value);
      else notices.push(profit.status === "rejected" ? String(profit.reason.message) : "El cliente seleccionado cambió. Vuelve a evaluar.");
      setNotice(notices.join(" "));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo evaluar el cliente."); }
    finally { setBusy(false); }
  }, [client, clearEvaluation]);
  useEffect(() => {
    if (!client) return;
    // Debounce selection and cancel the pending load if selection changes or unmounts.
    const timer = setTimeout(() => { void evaluate(); }, 150);
    return () => clearTimeout(timer);
  }, [client, evaluate]);
  return <section aria-label="Evaluación del cliente" className="space-y-6">
    <div className="rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">¿A quién evaluamos?</h2><span className="text-xs text-[var(--auth-text-muted)]">Datos de Holistic y Profit</span></div>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_100px_auto]">
        <label className="text-sm">Buscar cliente<input type="search" value={search} disabled={busy} onChange={(e) => setSearch(e.target.value)} placeholder="Escribe un nombre" className={control}/></label>
        <label className="text-sm">Cliente<select value={clientId} disabled={busy || listBusy} onChange={(e) => { setClientId(e.target.value); clearEvaluation(); }} className={control}><option value="">{listBusy ? "Cargando clientes…" : "Selecciona un cliente"}</option>{clients.filter((c) => c.id === clientId || c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-sm">Moneda<select value={currency} disabled={busy} onChange={(e) => { setCurrency(e.target.value as "USD" | "PEN"); clearEvaluation(); }} className={control}><option>USD</option><option>PEN</option></select></label>
        <button type="button" disabled={!client || busy} onClick={evaluate} className={primary}>{busy ? "Evaluando…" : snapshot || feeReference ? "Volver a consultar" : "Reintentar carga"}</button>
      </div>
      {!listBusy && !clients.length && !error && <p className="mt-3 text-sm">No hay clientes disponibles para esta cuenta.</p>}
      {search && !clients.some((c) => c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className="mt-3 text-sm">No hay coincidencias. Prueba con otro nombre.</p>}
      {error && <div role="alert" className="mt-3 text-sm text-[var(--auth-text)]">{error} {!clients.length && <button type="button" className={button} onClick={() => { setError(""); setListBusy(true); setListAttempt((n) => n + 1); }}>Reintentar</button>}</div>}
    </div>
    {!client ? <p className="py-4 text-sm text-[var(--auth-text-muted)]">Elige un cliente para preparar su crédito o ajustar su FEE.</p> : busy ? <p role="status" className="py-4 text-sm">Cargando el FEE y contexto de {client.name}…</p> : <>
      <div className="flex flex-wrap gap-2 border-b border-[var(--auth-border)] pb-4" aria-label="Decisión para este cliente">{([["credit", "Evaluar crédito"], ["fee", "Evaluar cambio de FEE"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)} className={mode === key ? primary : button}>{label}</button>)}</div>
      {mode === "credit" ? <CreditProposal key={`${clientId}:${currency}:${evaluationRevision}`} clientId={clientId} clientName={client.name} currency={currency} feeReference={feeReference}/> : <ClientImpact key={`${clientId}:${currency}:${evaluationRevision}`} clientId={clientId} clientName={client.name} mode="fee" snapshot={snapshot} feeReference={feeReference} currency={currency} requested={null} onRequested={() => {}}/>}
      {notice && <p role="status" className="text-sm text-[var(--auth-text-muted)]">{notice}</p>}
      {snapshot && <details className="border-t border-[var(--auth-border)] pt-4"><summary className="cursor-pointer text-sm font-medium">Ver contexto de Profit y score del cliente</summary><div className="mt-4"><CreditBehavior snapshot={snapshot} busy={false}/></div></details>}
    </>}
  </section>;
}
