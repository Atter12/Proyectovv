"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AssistantResponse } from "@/lib/ops/assistant-response";
import { AssistantIcon, type AssistantIconName } from "./AssistantIcon";
import { OpsAssistantReport } from "./OpsAssistantReport";
import styles from "./OpsAssistant.module.css";

type Turn = { id: string; question: string; time: string; answer?: AssistantResponse; error?: string };

const SUGGESTIONS: { title: string; description: string; question: string; icon: AssistantIconName }[] = [
  { title: "Pagos de hoy", description: "Consulta cuánto ingresó.", question: "Pagos de hoy", icon: "calendar" },
  { title: "Recargas y fee", description: "Revisa el movimiento de la semana.", question: "Recarga y fee de esta semana", icon: "chart" },
  { title: "Clientes activos", description: "Conoce quiénes están operando.", question: "¿Qué clientes están activos hoy?", icon: "users" },
  { title: "Alertas de cartera", description: "Identifica qué requiere atención.", question: "¿Hay alertas?", icon: "bell" },
];

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
  return <div className={styles.copyRow}>
    <button type="button" className={styles.textButton} onClick={() => void copy()}><AssistantIcon name={state === "copied" ? "check" : "copy"} />{state === "copied" ? "Copiado" : "Copiar respuesta"}</button>
    <span className={styles.copyFeedback} role="status">{state === "error" ? "No se pudo copiar. Selecciona el texto para copiarlo." : state === "copied" ? "Respuesta copiada." : ""}</span>
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
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (turns.length) lastTurn.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, [turns.length]);
  useEffect(() => {
    if (focusComposer.current) {
      input.current?.focus({ preventScroll: true });
      focusComposer.current = false;
    }
  }, [started]);

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

  const composer = <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
    <label htmlFor={inputId} className={styles.srOnly}>Pregunta sobre la cartera general</label>
    <textarea ref={input} id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(draft); } }}
      maxLength={500} rows={2} placeholder={started ? "Escribe otra consulta sobre tu cartera…" : "¿Qué necesitas saber de tu cartera?"} aria-describedby={`${inputId}-hint`} />
    <div className={styles.composerFooter}>
      <span className={styles.scope}><AssistantIcon name="briefcase" /> Cartera general</span>
      <div className={styles.sendGroup}><span id={`${inputId}-hint`} className={styles.keyHint}>{draft.length >= 400 ? `${draft.length}/500` : "Enter para enviar"}</span><button className={styles.sendButton} type="submit" disabled={busy || !draft.trim()} aria-label="Enviar consulta"><AssistantIcon name="arrowUp" /></button></div>
    </div>
  </form>;

  return <section className={styles.surface} data-started={started} aria-label="Asistente de gerencia">
    <div className={styles.toolbar}><span className={styles.toolbarLabel}><AssistantIcon name="briefcase" /> Asistente de gerencia</span><button type="button" className={styles.newButton} onClick={reset}><AssistantIcon name="plus" /> Nueva consulta</button></div>
    {!started ? <div className={styles.welcome}>
      <header className={styles.intro}><AssistantMark /><h2>Tu cartera, más clara.</h2><p>Consulta pagos, clientes y alertas con datos de Hecom y Cartera Holistic.</p></header>
      {composer}
      <div className={styles.suggestions}><h3>Puedes empezar por aquí</h3>
        <div className={styles.suggestionGrid}>{SUGGESTIONS.map((item) => <button type="button" key={item.title} className={styles.suggestion} onClick={() => void ask(item.question)}><span className={styles.suggestionIcon}><AssistantIcon name={item.icon} /></span><span className={styles.suggestionCopy}><strong>{item.title}</strong><span>{item.description}</span></span><AssistantIcon name="arrowUpRight" /></button>)}</div>
        <div className={styles.extraSuggestions}><span>También puedes consultar</span><button type="button" onClick={() => void ask("¿A quién podemos dar crédito?")}>Crédito <AssistantIcon name="arrowUpRight" /></button><button type="button" onClick={() => void ask("¿Quién está en rojo?")}>Clientes en rojo <AssistantIcon name="arrowUpRight" /></button></div>
      </div>
      <p className={styles.sourceNote}><AssistantIcon name="database" /> Hecom y Cartera Holistic · Fuentes en cada reporte</p>
    </div> : <div className={styles.conversation}>
      <div className={styles.conversationHeading}><h2>{turns[0].answer?.blocks[0]?.title ?? "Tu consulta de cartera"}</h2><p><AssistantIcon name="briefcase" /> Cartera general de gerencia</p></div>
      <div className={styles.turns} aria-label="Conversación">{turns.map((turn, index) => <article key={turn.id} ref={index === turns.length - 1 ? lastTurn : undefined} className={styles.turn} aria-label={`Consulta: ${turn.question}`}>
        <div className={styles.userMessage}><div><p>{turn.question}</p><time dateTime={turn.time}>{new Date(turn.time).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</time></div><span className={styles.userAvatar} aria-label="Tú">Tú</span></div>
        <div className={styles.answer}><AssistantMark small /><div className={styles.answerContent}>
          <div className={styles.answerByline}><strong>Asistente</strong>{turn.answer?.today && <span>Datos al {turn.answer.today}</span>}</div>
          {turn.answer && <>{turn.answer.blocks.length ? turn.answer.blocks.map((block) => <OpsAssistantReport key={block.id} block={block} />) : <p className={styles.plainAnswer}>{turn.answer.reply}</p>}<CopyAnswer text={turn.answer.reply} /></>}
          {pendingId === turn.id && <p className={styles.loading} role="status"><span className={styles.loadingDot} /> Consultando los datos de tu cartera…</p>}
          {turn.error && <div className={styles.error} role="alert"><p>{turn.error}</p><button type="button" className={styles.textButton} disabled={busy} onClick={() => void ask(turn.question, turn.id)}><AssistantIcon name="retry" /> Reintentar consulta</button></div>}
        </div></div>
      </article>)}</div>
      <div className={styles.composerDock}>
        <div className={styles.followups} aria-label="Otras consultas">{SUGGESTIONS.filter((item) => item.question !== turns.at(-1)?.question).slice(0, 2).map((item) => <button key={item.title} type="button" disabled={busy} onClick={() => void ask(item.question)}><AssistantIcon name={item.icon} />{item.title}<AssistantIcon name="arrowUpRight" /></button>)}</div>
        {composer}<p className={styles.sessionNote}>Cada consulta es independiente. La conversación se conserva mientras esta página esté abierta.</p>
      </div>
    </div>}
    <span className={styles.srOnly} role="status">{!busy && turns.at(-1)?.answer ? "Respuesta disponible." : ""}</span>
  </section>;
}
