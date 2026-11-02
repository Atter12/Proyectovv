"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AD_ACCOUNTS_UPDATED } from "@/lib/events/modal-events";
import { TikTokLinkWizard } from "./TikTokLinkWizard.client";
import { TikTokProfileManager } from "./TikTokProfileManager.client";
import { TikTokFailureNotice, tiktokDanger, tiktokPrimary, tiktokQuiet, tiktokSecondary } from "./TikTokConnectionUI.client";
import styles from "./TikTokConnection.module.css";
import { tiktokCall, tiktokFailure, type TikTokCheck, type TikTokFailure, type TikTokProfile, type TikTokSnapshot, type TikTokVerification } from "./tiktok-connection-api";

type DisconnectPreview = { ticket: string; profile: TikTokProfile; linked: boolean; assignedCount: number };
type Screen = { type: "list" } | { type: "wizard"; reconnect?: TikTokProfile } | { type: "manage"; profile: TikTokProfile } | { type: "disconnect"; preview: DisconnectPreview };
const empty: TikTokSnapshot = { accounts: [], manageableAccounts: [], profiles: [] };
const checkedValue = (check?: TikTokCheck) => check?.state === "checked" ? check.value : undefined;

export function TikTokConnectionPanel() {
  const [snapshot, setSnapshot] = useState<TikTokSnapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadFailure, setLoadFailure] = useState<TikTokFailure | null>(null);
  const [failure, setFailure] = useState<TikTokFailure | null>(null);
  const [checks, setChecks] = useState<Record<string, TikTokCheck>>({});
  const [screen, setScreen] = useState<Screen>({ type: "list" });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const [disconnectedProfile, setDisconnectedProfile] = useState<TikTokProfile | null>(null);
  const controller = useRef<AbortController | null>(null);
  const snapshotVersion = useRef(0);
  const verificationVersion = useRef<Record<string, number>>({});
  const accountsUpdatedPending = useRef(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const profiles = snapshot.profiles;

  const loadSnapshot = useCallback(async (signal?: AbortSignal) => {
    const version = ++snapshotVersion.current;
    const data = await tiktokCall<TikTokSnapshot>(undefined, signal);
    if (!Array.isArray(data.profiles) || !Array.isArray(data.accounts)) throw { error: "No pudimos leer tus perfiles guardados. Vuelve a cargar la lista." };
    const current = { ...data, manageableAccounts: data.manageableAccounts ?? data.accounts };
    if (!signal?.aborted && version === snapshotVersion.current) { setSnapshot(current); setLoaded(true); setLoadFailure(null); }
    return current;
  }, []);
  const verifyOne = useCallback(async (profile: TikTokProfile, signal?: AbortSignal) => {
    if (signal?.aborted) return undefined;
    const version = (verificationVersion.current[profile.id] ?? 0) + 1;
    verificationVersion.current[profile.id] = version;
    setChecks((current) => ({ ...current, [profile.id]: { state: "checking" } }));
    try {
      const value = await tiktokCall<TikTokVerification>({ action: "profile", profileId: profile.id }, signal);
      if (!signal?.aborted && verificationVersion.current[profile.id] === version) { setChecks((current) => ({ ...current, [profile.id]: { state: "checked", value } })); return value; }
      return undefined;
    } catch (error) {
      if (!signal?.aborted && verificationVersion.current[profile.id] === version) setChecks((current) => ({ ...current, [profile.id]: { state: "error", failure: tiktokFailure(error) } }));
      return undefined;
    }
  }, []);
  const reload = useCallback(async () => {
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setLoading(true); setLoadFailure(null);
    try {
      const data = await loadSnapshot(active.signal);
      if (active.signal.aborted) return;
      setLoading(false);
      // Keep saved profiles visible immediately; verify a bounded set sequentially.
      for (const profile of data.profiles.slice(0, 5)) {
        if (active.signal.aborted) return;
        await verifyOne(profile, active.signal);
      }
    } catch (error) { if (!active.signal.aborted) setLoadFailure(tiktokFailure(error)); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }, [loadSnapshot, verifyOne]);
  useEffect(() => { void reload(); return () => controller.current?.abort(); }, [reload]);
  useEffect(() => {
    let active = true;
    async function refreshCreatedAccounts() {
      accountsUpdatedPending.current = false;
      try {
        await loadSnapshot();
        if (active) setNotice("Actualizamos las cuentas publicitarias disponibles. Puedes elegir las que usarán tu perfil.");
      } catch (error) { if (active) setLoadFailure(tiktokFailure(error)); }
    }
    const updated = () => { accountsUpdatedPending.current = true; if (!busy) void refreshCreatedAccounts(); };
    window.addEventListener(AD_ACCOUNTS_UPDATED, updated);
    if (!busy && accountsUpdatedPending.current) void refreshCreatedAccounts();
    return () => { active = false; window.removeEventListener(AD_ACCOUNTS_UPDATED, updated); };
  }, [busy, loadSnapshot]);
  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);
  useEffect(() => { if (screen.type !== "list") detailRef.current?.focus(); }, [screen]);

  function pauseChecks() {
    controller.current?.abort();
    for (const id of Object.keys(verificationVersion.current)) verificationVersion.current[id] += 1;
    setChecks((current) => Object.fromEntries(Object.entries(current).filter(([, check]) => check.state !== "checking")));
  }
  function back() {
    const id = screen.type === "manage" ? screen.profile.id : screen.type === "disconnect" ? screen.preview.profile.id : undefined;
    setScreen({ type: "list" }); setFailure(null); setPending("");
    requestAnimationFrame(() => {
      if (noticeRef.current?.textContent) noticeRef.current.focus();
      else (document.getElementById(id ? `tiktok-configure-${id}` : "tiktok-profiles-title"))?.focus();
    });
  }
  function startWizard(reconnect?: TikTokProfile) {
    pauseChecks(); setFailure(null); setNotice(""); setScreen({ type: "wizard", reconnect });
  }
  async function manage(profile: TikTokProfile) {
    pauseChecks(); setFailure(null); setNotice(""); setBusy(true); setPending(`Comprobando ${profile.name} en TikTok…`);
    try { await verifyOne(profile); setScreen({ type: "manage", profile }); }
    finally { setBusy(false); setPending(""); }
  }
  async function previewDisconnect(profile: TikTokProfile) {
    pauseChecks(); setFailure(null); setNotice(""); setBusy(true); setPending("Revisando las cuentas que se verían afectadas…");
    try { const preview = await tiktokCall<DisconnectPreview>({ action: "disconnect-preview", profileId: profile.id }); setScreen({ type: "disconnect", preview }); }
    catch (error) { setFailure(tiktokFailure(error)); }
    finally { setBusy(false); setPending(""); }
  }
  async function disconnect(preview: DisconnectPreview) {
    setBusy(true); setFailure(null);
    try {
      await tiktokCall({ action: "disconnect", profileId: preview.profile.id, ticket: preview.ticket, confirm: true });
      setSnapshot((current) => ({ ...current, profiles: current.profiles.filter((profile) => profile.id !== preview.profile.id) }));
      setChecks((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== preview.profile.id)));
      setDisconnectedProfile(preview.profile);
      back(); setNotice(`${preview.profile.name} quedó desvinculado de Adsholistic. Tu cuenta y tus publicaciones de TikTok se conservan.`);
    } catch (error) { setFailure(tiktokFailure(error)); }
    finally { setBusy(false); }
  }
  const controlsDisabled = busy || loading || screen.type === "wizard";
  return <section className={styles.connection} aria-labelledby="tiktok-profiles-title" aria-busy={loading}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 id="tiktok-profiles-title" tabIndex={-1} className="text-lg font-semibold text-[var(--auth-text)] focus-visible:outline-2">Perfiles de TikTok</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--auth-text-muted)]">Gestiona la conexión de tus perfiles y sus permisos desde Adsholistic.</p></div>
      <div className="flex flex-wrap gap-2">{screen.type === "list" ? <button type="button" className={tiktokQuiet} disabled={controlsDisabled} onClick={() => { setFailure(null); void reload(); }}>{loading ? "Actualizando…" : "Comprobar estado"}</button> : null}<button type="button" className={profiles.length ? tiktokSecondary : tiktokPrimary} disabled={controlsDisabled || !loaded} onClick={() => startWizard()}>{profiles.length ? "Vincular otro perfil" : "Vincular perfil con QR"}</button></div>
    </div>
    {loading && !loaded ? <div role="status" className="mt-5 border-t border-[var(--auth-border)] pt-5"><p className="text-sm text-[var(--auth-text-muted)]">Cargando tus perfiles guardados…</p><div aria-hidden="true" className="mt-3 h-14 rounded-lg bg-black/5"/></div> : null}
    {loadFailure ? <TikTokFailureNotice failure={loadFailure} retry={() => void reload()} retryLabel="Reintentar carga de perfiles"/> : null}
    {loaded && !profiles.length && !loadFailure && screen.type !== "wizard" ? <div className="mt-5 border-t border-[var(--auth-border)] pt-5"><p className="text-sm font-medium text-[var(--auth-text)]">Todavía no tienes perfiles guardados.</p><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--auth-text-muted)]">Vincula tu perfil con QR. Puedes hacerlo ahora y añadir cuentas publicitarias cuando las crees.</p></div> : null}
    {profiles.length ? <ul aria-label="Perfiles de TikTok guardados" className="mt-5 divide-y divide-[var(--auth-border)] border-t border-[var(--auth-border)]">{profiles.map((profile) => {
      const check = checks[profile.id];
      const verified = check?.state === "checked" ? check.value : undefined;
      const label = check?.state === "checking" ? "Comprobando con TikTok…" : verified ? verified.linked ? "Vinculado" : "Requiere autorización" : check?.state === "error" ? "Guardado · Sin comprobar" : "Guardado";
      const tone = verified?.linked ? "bg-emerald-50 text-emerald-800" : verified?.linked === false || check?.state === "error" ? "bg-amber-50 text-amber-900" : "bg-black/5 text-[var(--auth-text-muted)]";
      return <li key={profile.id} className="py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className={styles.avatar}>{profile.name.slice(0, 1).toLocaleUpperCase()}</span><div className="min-w-0"><div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><h3 className="min-w-0 max-w-full break-words text-lg font-semibold text-[var(--auth-text)]">{profile.name}</h3><span role="status" className={`rounded-md px-2 py-1 text-xs font-medium ${tone}`}>{label}</span></div>
          <p className="mt-2 text-sm text-[var(--auth-text-muted)]">{verified?.linked ? verified.assignedIds.length ? `${verified.assignedIds.length} cuenta${verified.assignedIds.length === 1 ? "" : "s"} ads vinculada${verified.assignedIds.length === 1 ? "" : "s"}` : "Sin cuentas ads vinculadas · Puedes añadirlas después" : verified?.linked === false ? "Vuelve a autorizar el acceso con un QR para usar este perfil." : "El perfil está guardado en Adsholistic."}</p>
          {verified ? <p className="mt-1 text-xs text-[var(--auth-text-muted)]">Comprobado: {new Date(verified.verifiedAt).toLocaleString("es-PE")}</p> : null}
        </div></div>{screen.type === "manage" && screen.profile.id === profile.id ? null : <div className="flex shrink-0 flex-wrap items-start gap-2"><button id={`tiktok-configure-${profile.id}`} type="button" className={tiktokPrimary} disabled={controlsDisabled} aria-controls="tiktok-profile-detail" onClick={() => verified?.linked === false ? startWizard(profile) : void manage(profile)}>{verified?.linked === false ? "Volver a autorizar" : "Configurar perfil"}</button>
          <details className="relative text-sm text-[var(--auth-text-muted)]"><summary className="min-h-11 cursor-pointer rounded-lg px-3 py-3 font-medium hover:bg-black/5 focus-visible:outline-2" aria-label={`Más opciones de ${profile.name}`}>Más opciones</summary><div className="mt-2 max-w-xs space-y-2"><p className="text-xs leading-5">Puedes retirar la autorización del perfil completo y volver a conectarlo con QR cuando lo necesites.</p><button type="button" disabled={controlsDisabled} onClick={() => previewDisconnect(profile)} className={`${tiktokQuiet} text-rose-700`}>Desvincular perfil completo</button></div></details>
        </div>}</div>
        {check?.state === "error" ? <TikTokFailureNotice failure={check.failure} retry={() => void manage(profile)} retryLabel="Reintentar verificación"/> : null}
      </li>;
    })}</ul> : null}
    {pending ? <p role="status" className="mt-4 text-sm text-[var(--auth-text-muted)]">{pending}</p> : null}
    {notice ? <div className="mt-4 rounded-lg bg-emerald-50 p-4"><p ref={noticeRef} tabIndex={-1} role="status" className="text-sm leading-6 text-emerald-900 focus-visible:outline-2">{notice}</p>{disconnectedProfile ? <button type="button" className={`${tiktokSecondary} mt-3`} onClick={() => startWizard(disconnectedProfile)}>Volver a vincular con QR</button> : null}</div> : null}
    <div id="tiktok-profile-detail" ref={detailRef} tabIndex={-1} className="outline-none">
      {screen.type === "wizard" ? <TikTokLinkWizard accounts={snapshot.accounts} reconnect={screen.reconnect} onBusy={setBusy} onCancel={back} onSaved={(profile, results) => {
        setSnapshot((current) => ({ ...current, profiles: [profile, ...current.profiles.filter((saved) => saved.id !== profile.id)] }));
        setDisconnectedProfile(null);
        const complete = results.every((result) => result.ok);
        void verifyOne(profile).then((value) => {
          if (complete && value) setNotice(`${profile.name} quedó guardado. ${value.assignedIds.length ? `${value.assignedIds.length} cuenta${value.assignedIds.length === 1 ? "" : "s"} ads vinculada${value.assignedIds.length === 1 ? "" : "s"}.` : "Sin cuentas ads vinculadas; puedes añadirlas después."}`);
        });
        if (complete) { back(); setNotice(`${profile.name} quedó guardado. Puedes gestionar sus cuentas publicitarias desde aquí.`); }
      }}/> : null}
      {screen.type === "manage" ? <TikTokProfileManager key={screen.profile.id} profile={screen.profile} accounts={snapshot.manageableAccounts} initialVerification={checkedValue(checks[screen.profile.id])} onBusy={setBusy} onVerified={(value) => { verificationVersion.current[screen.profile.id] = (verificationVersion.current[screen.profile.id] ?? 0) + 1; setChecks((current) => ({ ...current, [screen.profile.id]: { state: "checked", value } })); }} onClose={back} onReconnect={() => startWizard(screen.profile)} onDisconnect={() => void previewDisconnect(screen.profile)} refreshAccounts={async () => { await loadSnapshot(); }}/>: null}
      {screen.type === "disconnect" ? <div className="mt-5 border-t border-[var(--auth-border)] pt-6"><div className="max-w-2xl rounded-lg bg-rose-50 p-5"><h3 className="text-base font-semibold text-rose-950">Desvincular {screen.preview.profile.name} de Adsholistic</h3><p className="mt-3 text-sm leading-6 text-rose-900">{screen.preview.linked ? `Retiraremos el permiso para usar este perfil y sus videos. Tiene ${screen.preview.assignedCount} cuenta${screen.preview.assignedCount === 1 ? "" : "s"} ads vinculada${screen.preview.assignedCount === 1 ? "" : "s"}. Los anuncios que usen esta identidad pueden verse afectados.` : "El acceso al perfil ya no aparece activo en TikTok. Actualizaremos su estado aquí."}</p><p className="mt-3 text-sm leading-6 text-rose-900">Tu cuenta de TikTok, sus publicaciones y tus cuentas publicitarias se conservan. Podrás volver a conectar el perfil con un nuevo QR.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={tiktokDanger} disabled={busy} onClick={() => disconnect(screen.preview)}>{busy ? "Desvinculando…" : "Confirmar y desvincular perfil"}</button><button type="button" className={tiktokSecondary} disabled={busy} onClick={back}>Cancelar</button><button type="button" className={tiktokQuiet} disabled={busy} onClick={() => previewDisconnect(screen.preview.profile)}>Actualizar confirmación</button></div></div></div> : null}
    </div>
    {failure ? <TikTokFailureNotice failure={failure}/> : null}
  </section>;
}
