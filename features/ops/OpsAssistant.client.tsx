"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AssistantResponse } from "@/lib/ops/assistant-response";
import { AssistantIcon, type AssistantIconName } from "./AssistantIcon";
import { OpsAssistantReport } from "./OpsAssistantReport";
import styles from "./OpsAssistant.module.css";

type Turn = { id: string; question: string; time: string; answer?: AssistantResponse; error?: string };
type Query = { title: string; description: string; question: string; icon: AssistantIconName };

const QUERY_GROUPS: { title: string; icon: AssistantIconName; queries: Query[] }[] = [
  { title: "Ingresos", icon: "wallet", queries: [
    { title: "Pagos de hoy", description: "Cuánto ingresó, por cliente.", question: "Pagos de hoy", icon: "calendar" },
    { title: "Recargas y fee", description: "El movimiento de la semana.", question: "Recarga y fee de esta semana", icon: "chart" },
  ] },
  { title: "Clientes", icon: "users", queries: [
    { title: "Clientes activos", description: "Quiénes están operando hoy.", question: "¿Qué clientes están activos hoy?", icon: "pulse" },
    { title: "Crédito", description: "A quién podemos dar crédito.", question: "¿A quién podemos dar crédito?", icon: "briefcase" },
  ] },
  { title: "Riesgo", icon: "alert", queries: [
    { title: "Alertas de cartera", description: "Qué requiere atención.", question: "¿Hay alertas?", icon: "bell" },
    { title: "Clientes en rojo", description: "Quién está en rojo.", question: "¿Quién está en rojo?", icon: "alert" },
  ] },
];
const QUERIES = QUERY_GROUPS.flatMap((group) => group.queries);

function AssistantMark({ small = false }: { small?: boolean }) {
  return <span className={small ? styles.markSmall : styles.mark} aria-hidden="true">h</span>;
}

function CopyAnswer({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("error"); }
    timer.current = setTimeout(() => setState("idle"), 3500);
  }
  return <>
    <button type="button" className={styles.textButton} data-state={state} onClick={() => void copy()}><AssistantIcon name={state === "copied" ? "check" : "copy"} />{state === "copied" ? "Copiado" : "Copiar respuesta"}</button>
    <span className={styles.copyFeedback} role="status">{state === "error" ? "No se pudo copiar. Selecciona el texto para copiarlo." : state === "copied" ? "Respuesta copiada." : ""}</span>
  </>;
}

function PendingAnswer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const interval = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);
  return <div className={styles.pending}>
    <p className={styles.loading} role="status"><span className={styles.loadingDot} />Consultando los datos de tu cartera…{seconds >= 4 && <span className={styles.elapsed}>{seconds} s</span>}</p>
    <div className={styles.skeleton} aria-hidden="true">
      <span className={styles.skeletonLine} style={{ width: "38%" }} />
      <span className={styles.skeletonLine} style={{ width: "86%" }} />
      <span className={styles.skeletonLine} style={{ width: "64%" }} />
      <span className={styles.skeletonPanel}><span /><span /><span /></span>
    </div>
  </div>;
}

export function OpsAssistant() {
  const inputId = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastTurn = useRef<HTMLElement>(null);
  const focusComposer = useRef(false);
  const busy = pendingId !== null;
  const started = turns.length > 0;
  const lastQuestion = turns.at(-1)?.question;
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (turns.length) lastTurn.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, [turns.length]);
  useEffect(() => {
    if (focusComposer.current) {
      input.current?.focus({ preventScroll: true });
      focusComposer.current = false;
    }
  }, [started]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function ask(text: string, retryId?: string) {
    const question = text.trim();
    if (!question || question.length > 500 || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const id = retryId ?? crypto.randomUUID();
    const turn: Turn = { id, question, time: new Date().toISOString() };
    if (!started) focusComposer.current = true;
    setTurns((current) => retryId ? current.map((item) => item.id === retryId ? turn : item) : [...current, turn]);
    if (!retryId) setDraft("");
    setPendingId(id);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    try {
      const response = await fetch("/api/ops/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question }), signal: controller.signal });
      const data = await response.json().catch(() => null) as (Partial<AssistantResponse> & { error?: string }) | null;
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "No pude consultar la cartera. Intenta de nuevo.");
      if (typeof data?.reply !== "string") throw new Error("El reporte llegó incompleto. Intenta de nuevo.");
      const answer: AssistantResponse = { reply: data.reply, today: data.today ?? "", blocks: Array.isArray(data.blocks) ? data.blocks : [] };
      if (request.current !== controller) return;
      setTurns((current) => current.map((item) => item.id === id ? { ...item, answer } : item));
    } catch (error) {
      if (request.current !== controller) return;
      const message = timedOut ? "La consulta está tardando más de lo esperado. Intenta de nuevo." : error instanceof TypeError ? "No pude conectar con el reporte. Revisa tu conexión e intenta de nuevo." : error instanceof Error ? error.message : "No pude consultar la cartera. Intenta de nuevo.";
      setTurns((current) => current.map((item) => item.id === id ? { ...item, error: message } : item));
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setPendingId(null); }
    }
  }

  function reset() {
    request.current?.abort();
    request.current = null;
    setPendingId(null);
    focusComposer.current = started;
    setTurns([]);
    setDraft("");
    if (!started) input.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const nearLimit = draft.length >= 400;
  const composer = <form className={styles.composer} data-busy={busy} onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
    <label htmlFor={inputId} className={styles.srOnly}>Pregunta sobre la cartera general</label>
    <textarea ref={input} id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(draft); }
        else if (event.key === "ArrowUp" && !draft && lastQuestion) { event.preventDefault(); setDraft(lastQuestion); }
        else if (event.key === "Escape" && draft) { event.preventDefault(); setDraft(""); }
      }}
      maxLength={500} rows={started ? 1 : 2} placeholder={started ? "Escribe otra consulta sobre tu cartera…" : "¿Qué necesitas saber de tu cartera?"} aria-describedby={`${inputId}-hint`} />
    <div className={styles.composerFooter}>
      <span className={styles.scope}><AssistantIcon name="briefcase" /> Cartera general</span>
      <div className={styles.sendGroup}>
        <span id={`${inputId}-hint`} className={styles.keyHint} data-warn={draft.length >= 480}>
          {nearLimit ? `${draft.length}/500` : <><kbd>Enter</kbd> enviar <span className={styles.hintExtra}>{started ? <><kbd>↑</kbd> repetir última</> : <><kbd>Shift</kbd>+<kbd>Enter</kbd> nueva línea</>}</span></>}
        </span>
        <button className={styles.sendButton} type="submit" disabled={busy || !draft.trim()} aria-label={busy ? "Consultando" : "Enviar consulta"}>{busy ? <span className={styles.sendSpinner} aria-hidden="true" /> : <AssistantIcon name="arrowUp" />}</button>
      </div>
    </div>
  </form>;

  return <section className={styles.surface} data-started={started} aria-label="Asistente de gerencia">
    {!started ? <div className={styles.welcome}>
      <header className={styles.intro}><AssistantMark /><h2>Tu cartera, más clara.</h2><p>Consulta pagos, clientes y alertas con datos de Hecom y Cartera Holistic.</p></header>
      {composer}
      <p className={styles.shortcutNote}>Pulsa <kbd>/</kbd> desde cualquier parte de la página para escribir.</p>
      <nav className={styles.queryIndex} aria-label="Consultas frecuentes">
        {QUERY_GROUPS.map((group) => <div key={group.title} className={styles.queryGroup} role="group" aria-labelledby={`${inputId}-${group.title}`}>
          <h3 id={`${inputId}-${group.title}`}><AssistantIcon name={group.icon} />{group.title}</h3>
          <ul>{group.queries.map((item) => <li key={item.title}><button type="button" className={styles.query} onClick={() => void ask(item.question)}>
            <span className={styles.queryCopy}><strong>{item.title}</strong><span>{item.description}</span></span>
            <span className={styles.queryArrow}><AssistantIcon name="arrowUpRight" /></span>
          </button></li>)}</ul>
        </div>)}
      </nav>
      <p className={styles.sourceNote}><AssistantIcon name="database" /> Hecom y Cartera Holistic · Fuentes en cada reporte</p>
    </div> : <div className={styles.conversation}>
      <div className={styles.toolbar}>
        <div className={styles.conversationHeading}><h2>{lastQuestion}</h2><p><AssistantIcon name="briefcase" /> Cartera general · {turns.length} {turns.length === 1 ? "consulta" : "consultas"}</p></div>
        <button type="button" className={styles.newButton} onClick={reset}><AssistantIcon name="plus" /> Nueva consulta</button>
      </div>
      <div className={styles.turns} aria-label="Conversación">{turns.map((turn, index) => <article key={turn.id} ref={index === turns.length - 1 ? lastTurn : undefined} className={styles.turn} aria-label={`Consulta: ${turn.question}`}>
        <div className={styles.userMessage}><div><p>{turn.question}</p><time dateTime={turn.time}>{new Date(turn.time).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</time></div><span className={styles.userAvatar} aria-label="Tú">Tú</span></div>
        <div className={styles.answer}><AssistantMark small /><div className={styles.answerContent}>
          <div className={styles.answerByline}><strong>Asistente</strong>{turn.answer?.today && <span className={styles.dataStamp}><span className={styles.liveDot} aria-hidden="true" />Datos al {turn.answer.today}</span>}</div>
          {turn.answer && <div className={styles.answerBody}>
            {turn.answer.blocks.length ? turn.answer.blocks.map((block) => <OpsAssistantReport key={block.id} block={block} />) : <p className={styles.plainAnswer}>{turn.answer.reply}</p>}
            <div className={styles.answerActions}>
              <CopyAnswer text={turn.answer.reply} />
              <button type="button" className={styles.textButton} disabled={busy} onClick={() => void ask(turn.question)}><AssistantIcon name="retry" /> Actualizar datos</button>
            </div>
          </div>}
          {pendingId === turn.id && <PendingAnswer />}
          {turn.error && <div className={styles.error} role="alert"><AssistantIcon name="alert" /><div><p>{turn.error}</p><button type="button" className={styles.textButton} disabled={busy} onClick={() => void ask(turn.question, turn.id)}><AssistantIcon name="retry" /> Reintentar consulta</button></div></div>}
        </div></div>
      </article>)}</div>
      <div className={styles.composerDock}>
        <div className={styles.followups} aria-label="Otras consultas">{QUERIES.filter((item) => !turns.some((turn) => turn.question === item.question)).slice(0, 3).map((item) => <button key={item.title} type="button" disabled={busy} onClick={() => void ask(item.question)}><AssistantIcon name={item.icon} />{item.title}</button>)}</div>
        {composer}<p className={styles.sessionNote}>Cada consulta es independiente. La conversación se conserva mientras esta página esté abierta.</p>
      </div>
    </div>}
    <span className={styles.srOnly} role="status">{!busy && turns.at(-1)?.answer ? "Respuesta disponible." : ""}</span>
  </section>;
}
