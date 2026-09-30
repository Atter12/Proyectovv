"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFormHeading, AuthNotice, AuthSubmitButton } from "@/features/auth/components/AuthFormUi";
import styles from "@/features/auth/components/auth.module.css";
import { startNasMembershipCheckoutAction, submitMembershipCaptureAction } from "../actions";
import type { MembershipCaptureStep } from "../lib/payment-capture";

const STEPS = ["Cuenta verificada", "Contrato enviado a firma", "Pago de la membresía", "Captura aceptada"] as const;

export function MembershipCheckout({
  step,
  reason,
}: {
  step: MembershipCaptureStep;
  reason: string | null;
}) {
  const router = useRouter();
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

  async function upload(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submitMembershipCaptureAction(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const current = step === "pay" ? 2 : 3;

  return (
    <div className="w-full">
      <AuthFormHeading title="Activa tu acceso">
        El contrato llega a tu WhatsApp y a tu correo. El panel se abre cuando el correo del pago cuadra con la captura.
      </AuthFormHeading>
      <ol className="mb-6 grid gap-2">
        {STEPS.map((title, index) => (
          <li
            key={title}
            className={
              index === current
                ? "flex items-center gap-3 rounded-2xl border border-[var(--auth-accent)] bg-[var(--auth-accent-soft)] px-4 py-3"
                : "flex items-center gap-3 rounded-2xl border border-[var(--auth-border)] px-4 py-3"
            }
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent)] text-xs font-bold text-white">
              {index < current ? "✓" : index + 1}
            </span>
            <span className="text-sm font-semibold text-[var(--auth-text)]">{title}</span>
          </li>
        ))}
      </ol>
      {step === "review" ? (
        <AuthNotice tone="info">
          Recibimos la captura. El panel se abre cuando el correo del pago cuadra con ella.
        </AuthNotice>
      ) : null}
      {step === "rejected" ? <AuthNotice tone="error">{reason ?? "La captura no se aceptó. Sube la del pago terminado."}</AuthNotice> : null}
      {step !== "review" ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void pay();
          }}
        >
          <AuthNotice tone="info">
            El pago se abre en NAS. Al volver, sube la captura. La confirmamos con el correo que llega del cobro.
          </AuthNotice>
          {error && step === "pay" ? <AuthNotice tone="error">{error}</AuthNotice> : null}
          <AuthSubmitButton loading={pending && step === "pay"} loadingLabel="Abriendo el pago…">
            {step === "pay" ? "Ir a pagar" : "Volver a NAS"}
          </AuthSubmitButton>
        </form>
      ) : null}
      {step === "capture" || step === "rejected" ? (
        <form className={`${styles.form} mt-4`} action={upload}>
          <label className="text-sm font-semibold text-[var(--auth-text)]" htmlFor="capture">
            Captura del pago
          </label>
          <input id="capture" name="capture" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
          <AuthSubmitButton loading={pending} loadingLabel="Revisando la captura…">
            Enviar captura
          </AuthSubmitButton>
        </form>
      ) : null}
    </div>
  );
}
