"use client";
import { useEffect, useRef, useState } from "react";
import { tiktokCall, tiktokFailure, type TikTokAccount, type TikTokFailure, type TikTokProfile, type TikTokResult } from "./tiktok-connection-api";
import { TikTokCheckbox, TikTokFailureNotice, tiktokPrimary, tiktokQuiet, tiktokSecondary } from "./TikTokConnectionUI.client";

import styles from "./TikTokConnection.module.css";

type Qr = { ticket: string; expiresAt: number; qrDataUrl: string };
type Detected = { assetId: string; name: string };
export function TikTokLinkWizard({ accounts, reconnect, onSaved, onCancel, onBusy }: {
  accounts: TikTokAccount[]; reconnect?: TikTokProfile;
  onSaved: (profile: TikTokProfile, results: TikTokResult[]) => void; onCancel: () => void; onBusy: (busy: boolean) => void;
}) {
  const [name, setName] = useState(reconnect?.name ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [qr, setQr] = useState<Qr | null>(null);
  const [profile, setProfile] = useState<Detected | null>(null);
  const [failure, setFailure] = useState<TikTokFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [pollVersion, setPollVersion] = useState(0);
  const [waiting, setWaiting] = useState("");
  const [results, setResults] = useState<TikTokResult[] | null>(null);
  const [discard, setDiscard] = useState(false);
  const inFlight = useRef(false);
  const expired = Boolean(qr && qr.expiresAt <= now);
  const available = accounts.filter((account) => !reconnect || account.bcId === reconnect.bcId);
  const selectedBc = available.find((account) => selected.includes(account.id))?.bcId;
  function working(value: boolean) { setBusy(value); onBusy(value); }
  async function start() {
    working(true); setFailure(null); setDiscard(false);
    try {
      const started = await tiktokCall<Qr>({ action: "start", profileName: name.trim(), advertiserIds: selected, ...(reconnect ? { reconnectProfileId: reconnect.id } : {}) });
      setNow(Date.now()); setProfile(null); setResults(null); setWaiting(""); setQr(started);
    } catch (error) { setFailure(tiktokFailure(error)); }
    finally { working(false); }
  }
  async function check() {
    if (!qr || inFlight.current) return;
    inFlight.current = true; working(true); setFailure(null);
    try {
      const data = await tiktokCall<{ profile?: Detected; message?: string }>({ action: "status", ticket: qr.ticket });
      if (data.profile) setProfile(data.profile);
      else setWaiting(data.message ?? "Todavía no detectamos la autorización. Acepta los permisos en TikTok y comprueba el nombre visible del perfil.");
      setPollVersion((value) => value + 1);
    } catch (error) { setFailure(tiktokFailure(error)); }
    finally { inFlight.current = false; working(false); }
  }
  async function save() {
    if (!qr) return;
    working(true); setFailure(null);
    try {
      const data = await tiktokCall<{ profile?: TikTokProfile; results?: TikTokResult[] }>({ action: "link", ticket: qr.ticket });
      if (!data.profile || !data.results) { setProfile(null); setWaiting("TikTok todavía no confirma la autorización. Comprueba los permisos en tu teléfono."); return; }
      setResults(data.results); onSaved(data.profile, data.results);
    } catch (error) { setFailure(tiktokFailure(error)); }
    finally { working(false); }
  }
  useEffect(() => {
    if (!qr || results) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [qr, results]);
  useEffect(() => {
    if (!qr || profile || results || expired || failure) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (controller.signal.aborted) return;
      if (Date.now() >= qr!.expiresAt) { setNow(Date.now()); return; }
      if (document.visibilityState === "hidden" || inFlight.current) { timer = setTimeout(poll, 6000); return; }
      inFlight.current = true;
      try {
        const data = await tiktokCall<{ profile?: Detected }>({ action: "status", ticket: qr!.ticket }, controller.signal);
        if (!controller.signal.aborted && data.profile) { setProfile(data.profile); return; }
      } catch (error) { if (!controller.signal.aborted) setFailure(tiktokFailure(error)); return; }
      finally { inFlight.current = false; }
      if (!controller.signal.aborted) timer = setTimeout(poll, 6000);
    }
    timer = setTimeout(poll, 6000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [qr, profile, results, expired, failure, pollVersion]);

  const seconds = qr ? Math.max(0, Math.ceil((qr.expiresAt - now) / 1000)) : 0;
  const remaining = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const step = profile || results ? 2 : qr ? 1 : 0;
  return <div className="mt-5 border-t border-[var(--auth-border)] pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold text-[var(--auth-text)]">{reconnect ? `Volver a autorizar ${reconnect.name}` : "Vincular un perfil con QR"}</h3><button type="button" disabled={busy} className={tiktokQuiet} onClick={() => qr && !results ? setDiscard(true) : onCancel()}>Volver a perfiles</button></div>
    {discard ? <div className="mt-3 max-w-2xl text-sm"><p className="leading-6 text-[var(--auth-text-muted)]">Si ya aceptaste los permisos en TikTok, termina de confirmar el perfil para guardarlo en Adsholistic antes de salir.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" className={tiktokSecondary} onClick={() => setDiscard(false)}>Continuar con la vinculación</button><button type="button" className={tiktokQuiet} onClick={onCancel}>Salir del asistente</button></div></div> : null}
    <ol aria-label="Pasos de vinculación" className={styles.wizardSteps}>{["Prepara tu perfil", "Escanea y autoriza", "Confirma y guarda"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={styles.wizardStep}><span>{index + 1}</span>{label}</li>)}</ol>
    {!qr ? <form onSubmit={(event) => { event.preventDefault(); void start(); }}>
      <label htmlFor="tiktok-handle" className="block text-sm font-medium text-[var(--auth-text)]">Nombre visible del perfil de TikTok</label>
      <input id="tiktok-handle" value={name} onChange={(event) => setName(event.target.value)} placeholder="Mi tienda" autoComplete="off" maxLength={64} required disabled={busy} aria-describedby="tiktok-profile-help" className="mt-2 h-11 w-full max-w-sm rounded-lg border border-[var(--auth-border)] bg-transparent px-3 text-base text-[var(--auth-text)] focus-visible:outline-2 focus-visible:outline-[var(--auth-accent)]"/>
      <p id="tiktok-profile-help" className="mt-2 max-w-xl text-sm leading-6 text-[var(--auth-text-muted)]">Usa el nombre que aparece en tu perfil, con sus espacios. Puede ser distinto de tu @usuario.</p>
      <fieldset className="mt-5" disabled={busy}><legend className="text-sm font-medium text-[var(--auth-text)]">Añadir cuentas ads ahora · opcional</legend>{available.length ? <div className="mt-2 max-h-64 divide-y divide-[var(--auth-border)] overflow-y-auto">{available.map((account) => <label key={account.id} className="flex items-start gap-3 py-3 text-sm text-[var(--auth-text)]"><TikTokCheckbox checked={selected.includes(account.id)} disabled={Boolean(selectedBc && selectedBc !== account.bcId)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, account.id] : current.filter((id) => id !== account.id))}/><span className="min-w-0 break-words">{account.name}<span className="mt-1 block break-all text-xs text-[var(--auth-text-muted)]">ID …{account.id.slice(-6)}{selectedBc && selectedBc !== account.bcId ? " · Requiere otro QR" : ""}</span></span></label>)}</div> : <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--auth-text-muted)]">Puedes vincular el perfil sin cuentas publicitarias. Cuando las crees, podrás añadirlas desde “Configurar perfil”.</p>}</fieldset>
      {available.length ? <p className="mt-2 text-xs text-[var(--auth-text-muted)]">La selección es opcional. Puedes guardar el perfil sin marcar ninguna cuenta y decidirlo después.</p> : null}
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--auth-text-muted)]">TikTok te mostrará los permisos para usar el perfil y sus videos en anuncios. Podrás retirar el acceso desde esta misma vista.</p>
      <button type="submit" className={`${tiktokPrimary} mt-4`} disabled={busy || !name.trim()}>{busy ? "Preparando QR…" : "Generar QR"}</button>
    </form> : expired && !results ? <div><h4 className="text-sm font-semibold text-[var(--auth-text)]">La sesión del QR venció</h4><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--auth-text-muted)]">Genera un nuevo código y vuelve a autorizar. Conservamos el nombre del perfil y tu selección de cuentas.</p><button type="button" className={`${tiktokPrimary} mt-4`} disabled={busy} onClick={start}>{busy ? "Preparando QR…" : "Generar nuevo QR"}</button></div> : !profile ? <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.qrDataUrl} alt="Código QR para autorizar tu perfil en TikTok" width={256} height={256} className="size-64 max-w-full shrink-0 rounded-lg bg-white"/>
      <div className="max-w-lg"><h4 className="text-base font-semibold text-[var(--auth-text)]">Escanea con el perfil {name}</h4><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--auth-text-muted)]"><li>Abre el escáner de TikTok en Perfil → Menú → Tu código QR.</li><li>Escanea y acepta los permisos que aparecen en TikTok.</li><li>Confirma el perfil aquí para guardarlo en Adsholistic.</li></ol><p className="mt-4 text-xs font-medium text-[var(--auth-text-muted)]">Código activo · vence en {remaining}</p><p role="status" className="mt-3 text-sm leading-6 text-[var(--auth-text)]">{waiting || "Esperando tu autorización en TikTok…"}</p><button type="button" className={`${tiktokSecondary} mt-4`} disabled={busy} onClick={check}>{busy ? "Comprobando…" : failure ? "Reintentar comprobación" : "Ya autoricé en TikTok"}</button></div>
    </div> : <div><h4 className="text-base font-semibold text-[var(--auth-text)]">{results ? "Perfil guardado; hay cuentas ads pendientes" : "Confirma que este es tu perfil"}</h4><p className="mt-2 break-words text-base text-[var(--auth-text)]">{profile.name}</p>{!results ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--auth-text-muted)]">{selected.length ? `Guardaremos este perfil y lo añadiremos a ${selected.length} cuenta${selected.length === 1 ? "" : "s"} ads.` : "Quedará guardado sin cuentas publicitarias. Podrás añadirlas después."}</p> : null}{results?.filter((result) => !result.ok && result.error).map((result) => <div key={result.advertiserId} className="mt-3"><p className="text-sm text-[var(--auth-text)]">{accounts.find((account) => account.id === result.advertiserId)?.name}</p><TikTokFailureNotice failure={result.error!}/></div>)}<div className="mt-4 flex flex-wrap gap-3"><button type="button" className={tiktokPrimary} disabled={busy} onClick={save}>{busy ? "Guardando…" : results ? "Reintentar cuentas pendientes" : "Confirmar y guardar perfil"}</button>{results ? <button type="button" className={tiktokSecondary} disabled={busy} onClick={onCancel}>Terminar y volver a perfiles</button> : null}</div></div>}
    {failure ? <TikTokFailureNotice failure={failure}/> : null}
  </div>;
}
