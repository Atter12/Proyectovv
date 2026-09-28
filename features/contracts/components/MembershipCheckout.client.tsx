"use client";

import { useState } from "react";
import { AuthFormHeading, AuthNotice, AuthSubmitButton } from "@/features/auth/components/AuthFormUi";
import styles from "@/features/auth/components/auth.module.css";
import { startNasMembershipCheckoutAction } from "../actions";

const STEPS = [
  { title: "Cuenta verificada", state: "done" },
  { title: "Contrato enviado a firma", state: "done" },
  { title: "Pago de la membresía", state: "current" },
  { title: "Entras al panel", state: "next" },
] as const;

export function MembershipCheckout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPending(true);
    setError(null);
    const result = await startNasMembershipCheckoutAction();
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <div className="w-full">
      <AuthFormHeading title="Activa tu acceso">
        El contrato ya va a tu WhatsApp y a tu correo para que lo firmes. El panel se abre cuando terminas el pago de la membresía.
      </AuthFormHeading>
      <ol className="mb-6 grid gap-2">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className={
              step.state === "current"
                ? "flex items-center gap-3 rounded-2xl border border-[var(--auth-accent)] bg-[var(--auth-accent-soft)] px-4 py-3"
                : "flex items-center gap-3 rounded-2xl border border-[var(--auth-border)] px-4 py-3"
            }
          >
            <span
              className={
                step.state === "next"
                  ? "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--auth-bg)] text-xs font-bold text-[var(--auth-text-muted)]"
                  : "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent)] text-xs font-bold text-white"
              }
            >
              {step.state === "done" ? "✓" : index + 1}
            </span>
            <span className="text-sm font-semibold text-[var(--auth-text)]">{step.title}</span>
          </li>
        ))}
      </ol>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void pay();
        }}
      >
        <AuthNotice tone="info">
          El pago se abre en NAS, en la misma ventana. Al terminar, vuelves a Ads Holistic y entras al panel.
        </AuthNotice>
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        <AuthSubmitButton loading={pending} loadingLabel="Abriendo el pago…">
          Ir a pagar
        </AuthSubmitButton>
      </form>
    </div>
  );
}
