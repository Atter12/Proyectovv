"use client";
import type { InputHTMLAttributes } from "react";
import type { TikTokFailure } from "./tiktok-connection-api";
import styles from "./TikTokConnection.module.css";

export const tiktokPrimary = `${styles.control} ${styles.primary}`;
export const tiktokSecondary = `${styles.control} ${styles.secondary}`;
export const tiktokQuiet = `${styles.control} ${styles.quiet}`;
export const tiktokDanger = `${styles.control} ${styles.danger}`;

export function TikTokCheckbox({ mixed = false, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { mixed?: boolean }) {
  return <span className={styles.checkbox}><input {...props} type="checkbox" className={styles.checkboxInput} ref={(node) => { if (node) node.indeterminate = mixed; }}/><span aria-hidden="true" className={styles.checkboxFace}>{mixed || props.checked ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={mixed ? "M4 8h8" : "m3.5 8 3 3 6-6"}/></svg> : null}</span></span>;
}

const iconPaths = {
  search: "m21 21-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z",
  refresh: "M20 7v5h-5M4 17v-5h5M5.4 7a8 8 0 0 1 13.2-2L20 7M4 17l1.4 2A8 8 0 0 0 18.6 17",
  unlink: "m9 15 6-6M7.5 16.5l-1 1a4 4 0 0 1-5.7-5.7l3-3a4 4 0 0 1 5.7 0M16.5 7.5l1-1a4 4 0 0 1 5.7 5.7l-3 3a4 4 0 0 1-5.7 0M4 3l2 2M19 19l2 2",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
};
export function TikTokIcon({ name }: { name: keyof typeof iconPaths }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}><path d={iconPaths[name]}/></svg>;
}

export function TikTokFailureNotice({ failure, retry, retryLabel = "Reintentar" }: { failure: TikTokFailure; retry?: () => void; retryLabel?: string }) {
  return <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
    <p className="max-w-2xl leading-6">{failure.error}</p>
    {retry ? <button type="button" className="mt-2 min-h-10 rounded-lg px-2 font-semibold underline underline-offset-4 focus-visible:outline-2" onClick={retry}>{retryLabel}</button> : null}
    {failure.endpoint || failure.detail || failure.code ? <details className="mt-2 text-xs"><summary className="min-h-8 cursor-pointer font-medium">Detalle para soporte</summary><p className="mt-2 break-words">{failure.detail}</p>{failure.required ? <p className="mt-2">{failure.required}</p> : null}<p className="mt-2 break-all">{[failure.endpoint, failure.code, failure.providerCode != null ? `Código ${failure.providerCode}` : null, failure.requestId ? `Referencia ${failure.requestId}` : null].filter(Boolean).join(" · ")}</p></details> : null}
  </div>;
}
