"use client";
import { useEffect, useRef, useState } from "react";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import { tiktokCall, tiktokFailure, unassignTikTokAccounts, type TikTokAccount, type TikTokFailure, type TikTokProfile, type TikTokResult, type TikTokVerification } from "./tiktok-connection-api";
import { TikTokCheckbox, TikTokFailureNotice, TikTokIcon, tiktokDanger, tiktokPrimary, tiktokQuiet, tiktokSecondary } from "./TikTokConnectionUI.client";
import styles from "./TikTokConnection.module.css";

export function TikTokProfileManager({ profile, accounts, initialVerification, onVerified, onClose, onReconnect, onDisconnect, onBusy, refreshAccounts }: {
  profile: TikTokProfile; accounts: TikTokAccount[]; initialVerification?: TikTokVerification;
  onVerified: (value: TikTokVerification) => void; onClose: () => void; onReconnect: () => void;
  onDisconnect: () => void;
  onBusy: (value: boolean) => void; refreshAccounts: () => Promise<void>;
}) {
  const [verification, setVerification] = useState(initialVerification);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedRemoval, setSelectedRemoval] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const bulkRemoveRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [failure, setFailure] = useState<TikTokFailure | null>(null);
  const [results, setResults] = useState<TikTokResult[]>([]);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"linked" | "available">((initialVerification?.assignedIds.length ?? 0) ? "linked" : "available");
  const [search, setSearch] = useState("");
  const assigned = verification?.assignedIds ?? [];
  const inCenter = accounts.filter((account) => account.bcId === profile.bcId);
  const linkedAccounts = inCenter.filter((account) => assigned.includes(account.id));
  const availableAccounts = inCenter.filter((account) => !assigned.includes(account.id));
  const filteredAccounts = (filter === "linked" ? linkedAccounts : availableAccounts).filter((account) => `${account.name} ${account.id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selectable = filteredAccounts.filter((account) => !account.status || account.status === "active");
  const allSelected = selectable.length > 0 && selectable.every((account) => selected.includes(account.id));
  const allRemovalSelected = filteredAccounts.length > 0 && filteredAccounts.every((account) => selectedRemoval.includes(account.id));
  const selectionCount = filter === "linked" ? selectedRemoval.length : selected.length;
  useEffect(() => { if (removing) confirmationRef.current?.focus(); }, [removing]);
  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);
  function update(value: TikTokVerification) { setVerification(value); onVerified(value); }
  function changeFilter(value: "linked" | "available") { setFilter(value); setRemoving(null); }
  function previewRemoval(ids: string[]) { setRemoving([...ids]); setFailure(null); setNotice(""); setResults([]); }
  async function verify() {
    setChecking(true); onBusy(true); setFailure(null);
    try { await refreshAccounts(); const latest = await tiktokCall<TikTokVerification>({ action: "profile", profileId: profile.id }); update(latest); setSelected((current) => current.filter((id) => !latest.assignedIds.includes(id))); setSelectedRemoval((current) => current.filter((id) => latest.assignedIds.includes(id))); setRemoving(null); setResults([]); }
    catch (error) { setFailure(tiktokFailure(error)); }
    finally { setChecking(false); onBusy(false); }
  }
  async function assign() {
    setChecking(true); onBusy(true); setFailure(null); setNotice("");
    try {
      const data = await tiktokCall<{ results: TikTokResult[] }>({ action: "assign", profileId: profile.id, advertiserIds: selected });
      setResults(data.results); setSelected(data.results.filter((result) => !result.ok).map((result) => result.advertiserId));
      const linked = [...new Set([...assigned, ...data.results.filter((result) => result.ok).map((result) => result.advertiserId)])];
      update({ linked: true, assignedIds: linked, verifiedAt: new Date().toISOString() });
      if (data.results.every((result) => result.ok)) { setFilter("linked"); setSearch(""); }
      setNotice(data.results.every((result) => result.ok) ? "Cuentas ads vinculadas. Ya pueden usar este perfil." : "Algunas cuentas quedaron pendientes. Puedes reintentar solo esas cuentas.");
    } catch (error) { setFailure(tiktokFailure(error)); }
    finally { setChecking(false); onBusy(false); }
  }
  async function unassign(ids: string[]) {
    setChecking(true); onBusy(true); setFailure(null); setNotice("");
    setProgress({ done: 0, total: ids.length });
    try {
      let completed = await unassignTikTokAccounts(profile.id, ids, (partial, total) => {
        setProgress({ done: partial.length, total });
        const removed = partial.filter((result) => result.ok).map((result) => result.advertiserId);
        if (removed.length) update({ linked: true, assignedIds: assigned.filter((id) => !removed.includes(id)), verifiedAt: new Date().toISOString() });
      });
      let profileLinked = true;
      try {
        const latest = await tiktokCall<TikTokVerification>({ action: "profile", profileId: profile.id });
        update(latest);
        profileLinked = latest.linked;
        // Resolve uncertain responses without repeating a removal already confirmed by TikTok.
        if (latest.linked) completed = completed.map((result) => !latest.assignedIds.includes(result.advertiserId) ? { advertiserId: result.advertiserId, ok: true } : result.ok ? { advertiserId: result.advertiserId, ok: false, error: { error: "Esta cuenta sigue vinculada en la última comprobación. Revisa y vuelve a intentarlo." } } : result);
      } catch (error) { setFailure(tiktokFailure(error)); }
      const removed = completed.filter((result) => result.ok).map((result) => result.advertiserId);
      const pending = completed.filter((result) => !result.ok).map((result) => result.advertiserId);
      setSelectedRemoval((current) => [...new Set([...current.filter((id) => !ids.includes(id)), ...pending])]);
      setRemoving(null); setResults(completed);
      const connection = profileLinked ? "Tu perfil sigue conectado a Adsholistic." : "El acceso al perfil requiere una nueva autorización con QR.";
      setNotice(pending.length ? `${removed.length} de ${ids.length} cuentas ads desvinculadas. ${pending.length} pendiente${pending.length === 1 ? "" : "s"}; revisa el detalle y reintenta. ${connection}` : `${removed.length === 1 ? "Cuenta ads desvinculada" : `${removed.length} cuentas ads desvinculadas`}. ${connection}`);
    } catch (error) { setFailure(tiktokFailure(error)); }
    finally { setChecking(false); onBusy(false); setProgress(null); }
  }
  const locked = checking || Boolean(removing);
  const visibleSelection = filter === "linked" ? filteredAccounts : selectable;
  const currentSelection = filter === "linked" ? selectedRemoval : selected;
  const allVisibleSelected = filter === "linked" ? allRemovalSelected : allSelected;
  const mixedSelection = !allVisibleSelected && visibleSelection.some((account) => currentSelection.includes(account.id));

  return <div className={styles.manager} aria-labelledby="tiktok-manager-title">
    <div className={styles.managerHeader}>
      <div>
        <h3 id="tiktok-manager-title" tabIndex={-1}>Cuentas publicitarias</h3>
        <p className={styles.description}>Elige qué cuentas pueden usar tu perfil y tus videos en anuncios.</p>
      </div>
      <div className={styles.headerActions}>
        <button type="button" className={`${tiktokQuiet} ${styles.refresh}`} data-busy={checking && !progress} disabled={locked} onClick={verify} aria-label="Comprobar conexión" title="Comprobar conexión"><TikTokIcon name="refresh"/></button>
        <button type="button" className={tiktokSecondary} disabled={checking} onClick={onClose}>Listo</button>
      </div>
    </div>

    {!verification ? <p className={styles.footnote}>Comprueba la autorización en TikTok para elegir las cuentas que usarán este perfil.</p> : !verification.linked ? <div className="mt-4">
      <p className={styles.description}>El acceso a este perfil ya no aparece en TikTok. Vuelve a autorizarlo antes de añadir cuentas.</p>
      <button type="button" className={`${tiktokPrimary} mt-3`} disabled={checking} onClick={onReconnect}>Volver a autorizar con QR</button>
    </div> : null}

    {verification?.linked && !inCenter.length ? <div className={styles.empty}>
      <h4>Perfil listo para conectar cuentas</h4>
      <p>Puedes conservarlo así. Cuando crees una cuenta publicitaria, aparecerá aquí para que decidas si la vinculas.</p>
      <AdAccountsOpenCreateModalButton className={`${tiktokSecondary} mt-4`}><TikTokIcon name="plus"/>Crear cuenta publicitaria TikTok</AdAccountsOpenCreateModalButton>
    </div> : null}

    {inCenter.length ? <>
      <div className={styles.tools}>
        <div role="group" aria-label="Mostrar cuentas publicitarias" className={styles.tabs}>
          <button type="button" aria-pressed={filter === "linked"} disabled={locked} onClick={() => changeFilter("linked")} className={styles.tab}>Vinculadas <span className={styles.tabCount}>{linkedAccounts.length}</span></button>
          <button type="button" aria-pressed={filter === "available"} disabled={locked} onClick={() => changeFilter("available")} className={styles.tab}>Por vincular <span className={styles.tabCount}>{availableAccounts.length}</span></button>
        </div>
        <label className={styles.search}>
          <span className="sr-only">Buscar cuenta publicitaria</span><TikTokIcon name="search"/>
          <input type="search" disabled={locked} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o ID"/>
        </label>
      </div>

      {verification?.linked ? <div className={styles.selectionToolbar}>
        <div className={styles.selectionGroup}>
          {visibleSelection.length ? <label className={styles.selectAll}>
            <TikTokCheckbox checked={allVisibleSelected} mixed={mixedSelection} disabled={locked} onChange={(event) => {
              const ids = visibleSelection.map((account) => account.id);
              const setSelection = filter === "linked" ? setSelectedRemoval : setSelected;
              setSelection((current) => event.target.checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)));
            }}/>
            {search.trim() ? "Seleccionar todas las visibles" : filter === "linked" ? "Seleccionar todas las vinculadas" : "Seleccionar cuentas disponibles"}
          </label> : null}
          {selectionCount ? <div className={styles.selectionSummary}>
            <span className={styles.selectionNumber}>{selectionCount}</span>
            <span>seleccionada{selectionCount === 1 ? "" : "s"}{search.trim() ? " en total" : ""}</span>
            <button type="button" className={`${tiktokQuiet} ${styles.clearSelection}`} aria-label="Limpiar selección" title="Limpiar selección" disabled={locked} onClick={() => filter === "linked" ? setSelectedRemoval([]) : setSelected([])}><TikTokIcon name="close"/></button>
          </div> : null}
        </div>
        {filter === "linked" && selectedRemoval.length ? <button ref={bulkRemoveRef} type="button" className={tiktokPrimary} disabled={locked} onClick={() => previewRemoval(selectedRemoval)}><TikTokIcon name="unlink"/>Desvincular {selectedRemoval.length} cuenta{selectedRemoval.length === 1 ? "" : "s"} ads</button> : !selectionCount ? <p className={styles.selectionHint}>Selecciona cuentas para gestionarlas juntas</p> : null}
      </div> : null}

      <fieldset className={styles.accountList} disabled={locked}>
        <legend className="sr-only">{filter === "linked" ? "Selecciona cuentas vinculadas para desvincularlas" : "Cuentas que puedes vincular"}</legend>
        {filteredAccounts.map((account) => {
          const linked = assigned.includes(account.id), inactive = Boolean(account.status && account.status !== "active");
          const chosen = (linked ? selectedRemoval : selected).includes(account.id);
          return <label key={account.id} className={styles.accountRow} data-selected={chosen}>
            <span className={styles.accountIdentity}>
              <TikTokCheckbox checked={chosen} disabled={!verification?.linked || (!linked && inactive)} onChange={(event) => {
                const setSelection = linked ? setSelectedRemoval : setSelected;
                setSelection((current) => event.target.checked ? [...new Set([...current, account.id])] : current.filter((id) => id !== account.id));
              }}/>
              <span className={styles.accountText}>
                <span className={styles.accountName}>{account.name}</span>
                <span className={styles.accountMeta}>ID …{account.id.slice(-6)}{!linked && inactive ? " · Cuenta no activa: no disponible para vincular" : ""}</span>
              </span>
            </span>
            <span aria-hidden="true" className={styles.rowStatus}>{linked ? <><span className={styles.statusDot}/>Vinculada</> : inactive ? "No disponible" : "Disponible"}</span>
          </label>;
        })}
        {!filteredAccounts.length ? <div className={styles.empty}>
          <h4>{search ? "No encontramos cuentas con esa búsqueda" : filter === "linked" ? "Este perfil está guardado sin cuentas ads" : "Todas las cuentas de esta conexión ya están vinculadas"}</h4>
          <p>{search ? "Prueba otro nombre o ID." : filter === "linked" ? "Puedes dejarlo así o elegir cuentas desde “Por vincular”." : "Puedes administrar sus permisos en “Vinculadas”."}</p>
        </div> : null}
      </fieldset>
    </> : null}

    {accounts.some((account) => account.bcId !== profile.bcId) ? <p className={styles.footnote}>Algunas cuentas necesitan una autorización adicional. Puedes conectarlas desde aquí con “Vincular otro perfil”.</p> : null}

    {removing ? <div ref={confirmationRef} tabIndex={-1} role="region" aria-labelledby="tiktok-unassign-title" className={styles.confirmation}>
      <h4 id="tiktok-unassign-title" className={styles.confirmationTitle}><TikTokIcon name="unlink"/>Desvincular {removing.length} cuenta{removing.length === 1 ? "" : "s"} ads</h4>
      <p>Estas cuentas dejarán de usar el perfil y sus videos. Las campañas que los utilicen pueden verse afectadas. Tu perfil seguirá conectado a Adsholistic y las cuentas publicitarias se conservarán.</p>
      <ul aria-label="Cuentas que se desvincularán">{removing.map((id) => <li key={id}>{accounts.find((account) => account.id === id)?.name ?? "Cuenta publicitaria"}<span>ID …{id.slice(-6)}</span></li>)}</ul>
      <div className={styles.confirmationActions}>
        <button type="button" className={tiktokDanger} disabled={checking} onClick={() => unassign(removing)}>{progress ? `Desvinculando ${progress.done} de ${progress.total}…` : `Confirmar y desvincular ${removing.length}`}</button>
        <button type="button" className={tiktokSecondary} disabled={checking} onClick={() => { setRemoving(null); setFailure(null); requestAnimationFrame(() => (bulkRemoveRef.current ?? document.getElementById("tiktok-manager-title"))?.focus()); }}>Cancelar</button>
      </div>
    </div> : null}

    {progress ? <div className={styles.progress}>
      <p role="status" aria-live="polite">Desvinculando cuentas ads: {progress.done} de {progress.total} revisadas. Mantén esta página abierta.</p>
      <div aria-hidden="true" className={styles.progressTrack}><span style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }}/></div>
    </div> : null}
    {notice ? <p ref={noticeRef} tabIndex={-1} role="status" className={styles.notice}><TikTokIcon name="check"/>{notice}</p> : null}
    {results.filter((result) => !result.ok && result.error).map((result) => <div key={result.advertiserId} className="mt-4"><p className={styles.description}>{accounts.find((account) => account.id === result.advertiserId)?.name}</p><TikTokFailureNotice failure={result.error!}/></div>)}
    {failure ? <TikTokFailureNotice failure={failure}/> : null}

    {filter === "available" && selected.length ? <div className={styles.availableActions}>
      <p className={styles.footnote}>Solo se añadirán las cuentas que seleccionaste.</p>
      <button type="button" className={tiktokPrimary} disabled={locked || !verification?.linked} onClick={assign}><TikTokIcon name="plus"/>{checking ? "Vinculando…" : `Vincular ${selected.length} cuenta${selected.length === 1 ? "" : "s"}`}</button>
    </div> : null}

    <div className={styles.connectionSettings}>
      <div><h4>Conexión del perfil</h4><p>Retira la autorización del perfil completo y de todas sus cuentas ads. Podrás volver a conectarlo con QR.</p></div>
      <button type="button" className={`${tiktokQuiet} ${styles.disconnect}`} disabled={locked} onClick={onDisconnect}><TikTokIcon name="unlink"/>Desvincular perfil completo</button>
    </div>
  </div>;
}
