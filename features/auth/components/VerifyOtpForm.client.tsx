"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@/config/routes";
import {
  AuthCodeInput,
  AuthFormHeading,
  AuthNotice,
  AuthSubmitButton,
} from "./AuthFormUi";
import styles from "./auth.module.css";
import { createClient } from "@/lib/supabase/client";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";
import {
  HECOM_OTP_COOLDOWN_SECONDS,
  normalizeHecomOtpEmail,
} from "@/lib/auth/hecom-otp-email";
import { resolveSafeNextPath } from "@/lib/auth/safe-next-path";

async function assertAdminAccess(): Promise<boolean> {
  const response = await fetch(routes.api.auth.adminAccess, { cache: "no-store" });
  return response.ok;
}

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const isAdminContext = searchParams.get("context") === "admin";
  const isHecomFlow = searchParams.get("flow") === "hecom";
  const justSent = searchParams.get("sent") === "1";
  const initialCooldown = Number(searchParams.get("cooldown") ?? "");
  const adminDestination = resolveSafeNextPath(
    searchParams.get("next"),
    routes.adminOverview,
    { requiredPrefix: "/admin" },
  );
  const email = useMemo(
    () => normalizeHecomOtpEmail(emailParam),
    [emailParam],
  );
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(() => {
    if (!isHecomFlow || !justSent) return 0;
    if (Number.isFinite(initialCooldown) && initialCooldown > 0) {
      return Math.ceil(initialCooldown);
    }
    return HECOM_OTP_COOLDOWN_SECONDS;
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    searchParams.get("hint"),
  );

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  function applyResendCooldown(seconds?: number) {
    const next =
      typeof seconds === "number" && seconds > 0
        ? Math.ceil(seconds)
        : HECOM_OTP_COOLDOWN_SECONDS;
    setResendCooldown(next);
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Falta el correo electrónico. Vuelve al inicio de sesión.");
      setLoading(false);
      return;
    }

    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(code)) {
      setError("Introduce un código de 6 dígitos.");
      setLoading(false);
      return;
    }

    // Hecom (clientes + gerentes): verify + sesión + provision en un solo POST.
    // Evita doble verifyOtp en el browser (a veces deja el código “ya usado”).
    if (isHecomFlow) {
      try {
        const response = await fetch(routes.api.auth.otpVerify, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token: code }),
        });
        const payload = (await response.json()) as {
          error?: string;
          nextPath?: string;
          needsPicker?: boolean;
          accountReady?: boolean;
          isStaff?: boolean;
        };

        if (!response.ok) {
          setError(
            mapAuthErrorMessage(
              payload.error ??
                "No pudimos verificar el código. Pedí uno nuevo e intentá de nuevo.",
            ),
          );
          setLoading(false);
          return;
        }

        if (isAdminContext) {
          const allowed = await assertAdminAccess();
          router.push(allowed ? adminDestination : routes.adminUnauthorized);
          router.refresh();
          return;
        }

        if (payload.accountReady === false) {
          router.push(routes.accountSetup);
          router.refresh();
          return;
        }

        if (
          payload.nextPath === routes.clientes ||
          payload.needsPicker ||
          payload.isStaff
        ) {
          router.push(routes.clientes);
          router.refresh();
          return;
        }

        const destination = resolveSafeNextPath(
          searchParams.get("next"),
          payload.nextPath && payload.nextPath.startsWith("/")
            ? payload.nextPath
            : routes.overview,
        );
        router.push(destination);
        router.refresh();
        return;
      } catch {
        setError(
          "No pudimos verificar el código. Revisá tu conexión e intentá de nuevo.",
        );
        setLoading(false);
        return;
      }
    }

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (verifyError) {
        setError(mapAuthErrorMessage(verifyError.message));
        setLoading(false);
        return;
      }
    } catch {
      setError(
        "No pudimos verificar el código. Revisá tu conexión e intentá de nuevo.",
      );
      setLoading(false);
      return;
    }

    if (isAdminContext) {
      const allowed = await assertAdminAccess();
      router.push(allowed ? adminDestination : routes.adminUnauthorized);
      router.refresh();
      return;
    }

    const destination = resolveSafeNextPath(
      searchParams.get("next"),
      routes.overview,
    );
    router.push(destination);
    router.refresh();
  }

  async function handleResend() {
    if (!email) {
      setError("Falta el correo electrónico.");
      return;
    }
    if (resendCooldown > 0) return;

    setResending(true);
    setError(null);
    setSuccess(null);

    const flow = searchParams.get("flow");
    if (flow === "hecom") {
      try {
        const response = await fetch(routes.api.auth.otpRequest, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          retryAfterSec?: number;
        };
        if (!response.ok) {
          if (response.status === 429 && payload.retryAfterSec) {
            applyResendCooldown(payload.retryAfterSec);
          }
          setError(mapAuthErrorMessage(payload.error ?? "No se pudo reenviar."));
        } else {
          applyResendCooldown(payload.retryAfterSec);
          setOtp("");
          setSuccess(
            payload.message ??
              "Te enviamos un código nuevo. El anterior ya no sirve.",
          );
        }
      } catch {
        setError("No se pudo reenviar el código.");
      }
      setResending(false);
      return;
    }

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });

    if (resendError) {
      setError(mapAuthErrorMessage(resendError.message));
    } else {
      setSuccess("Te enviamos un nuevo código a tu correo.");
    }
    setResending(false);
  }

  return (
    <div className="w-full">
      <AuthFormHeading title="Revisa tu correo">
        Enviamos un código de 6 dígitos a
        <strong className={styles.destinationEmail}>
          {email || "tu correo electrónico"}
        </strong>
      </AuthFormHeading>

      <form onSubmit={handleVerify} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label htmlFor="otp" className={styles.fieldLabel}>
            Código de 6 dígitos
          </label>
          <AuthCodeInput
            id="otp"
            value={otp}
            onChange={setOtp}
            disabled={loading}
            invalid={Boolean(error)}
            describedBy={error ? "otp-error" : "otp-help"}
          />
          <p id="otp-help" className={styles.helpText}>
            {isHecomFlow
              ? "También puedes entrar desde el enlace del mismo correo."
              : "Copia y pega el código completo para verificar tu correo."}
          </p>
        </div>

        {error && (
          <AuthNotice tone="error" id="otp-error">{error}</AuthNotice>
        )}

        {success && (
          <AuthNotice tone="success">{success}</AuthNotice>
        )}

        <AuthSubmitButton loading={loading} loadingLabel="Verificando código…">
          Verificar y continuar
        </AuthSubmitButton>
      </form>

      <div className={styles.formFooter}>
        <p className={styles.muted}>¿No encuentras el correo? Revisa también spam.</p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className={styles.secondaryButton}
        >
          {resending
            ? "Reenviando…"
            : resendCooldown > 0
              ? `Reenviar código en ${resendCooldown}s`
              : "Reenviar código"}
        </button>
        {isHecomFlow ? (
          <p className={styles.helpText}>
            Si solicitas otro código, usa el más reciente.
          </p>
        ) : null}
        <p>
          <Link
            href={isAdminContext ? routes.adminLogin : routes.login}
            className={styles.textLink}
          >
            Usar otro correo
          </Link>
        </p>
      </div>
    </div>
  );
}
