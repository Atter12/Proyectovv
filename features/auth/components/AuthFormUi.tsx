"use client";

import { useState, type ReactNode } from "react";
import styles from "./auth.module.css";

export function AuthFormHeading({ title, children }: { title: string; children?: ReactNode }) {
  return <div className={styles.heading}><h1>{title}</h1>{children ? <p>{children}</p> : null}</div>;
}

export function AuthNotice({ tone, children, id }: { tone: "error" | "success" | "info"; children: ReactNode; id?: string }) {
  return <div id={id} className={`${styles.notice} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function AuthSubmitButton({ loading = false, children, loadingLabel = "Procesando…", disabled = false }: { loading?: boolean; children: ReactNode; loadingLabel?: string; disabled?: boolean }) {
  return (
    <button type="submit" className="auth-cta" disabled={loading || disabled} aria-busy={loading}>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {loading ? loadingLabel : children}
      {!loading ? <svg className={styles.submitArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
    </button>
  );
}

/** One native input retains autofill, paste, selection and keyboard behavior. */
export function AuthCodeInput({ id = "otp", value, onChange, disabled = false, invalid = false, describedBy }: { id?: string; value: string; onChange: (value: string) => void; disabled?: boolean; invalid?: boolean; describedBy?: string }) {
  const [caret, setCaret] = useState(0);
  return (
    <div className={styles.codeControl}>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        onPaste={(event) => {
          const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
          if (code) { event.preventDefault(); onChange(code); setCaret(Math.min(code.length, 5)); }
        }}
        onSelect={(event) => setCaret(Math.min(event.currentTarget.selectionStart ?? value.length, 5))}
        onPointerDown={(event) => {
          // The native input spans all six slots: align a tap with its visible digit.
          event.preventDefault();
          const input = event.currentTarget;
          const bounds = input.getBoundingClientRect();
          const slot = Math.min(5, Math.max(0, Math.floor((event.clientX - bounds.left) / bounds.width * 6)));
          const start = Math.min(slot, value.length);
          input.focus();
          input.setSelectionRange(start, Math.min(start + 1, value.length));
          setCaret(Math.min(start, 5));
        }}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={styles.codeInput}
      />
      <div className={styles.codeSlots} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <span key={index} className={styles.codeSlot} data-filled={Boolean(value[index])} data-active={index === caret}>{value[index] ?? ""}</span>)}
      </div>
    </div>
  );
}
