"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
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

const inputClassName =
  "h-12 w-full rounded-full border border-[var(--auth-input-border)] bg-[var(--auth-bg)] px-5 text-center text-[18px] tracking-[0.35em] text-[var(--auth-text)] placeholder:tracking-[0.35em] placeholder:text-[var(--auth-text-soft)] transition-[border-color,box-shadow,background-color] hover:border-[var(--auth-input-border-hover)] focus:border-[var(--auth-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/20";

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
      setError("Falta el correo electrónico. Volvé al inicio de sesión.");
      setLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Introducí un código de 6 dígitos.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let verifyError = (
      await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: isHecomFlow ? "magiclink" : "email",
      })
    ).error;

    // Fallback: algunos proyectos validan el OTP de magiclink como type email.
    if (verifyError && isHecomFlow) {
      verifyError = (
        await supabase.auth.verifyOtp({
          email,
          token: otp.trim(),
          type: "email",
        })
      ).error;
    }

    if (verifyError) {
      setError(mapAuthErrorMessage(verifyError.message));
      setLoading(false);
      return;
    }

    const flow = searchParams.get("flow");
    if (flow === "hecom") {
      try {
        const provisionRes = await fetch(routes.api.auth.otpProvision, {
          method: "POST",
        });
        const provisioned = (await provisionRes.json()) as {
          nextPath?: string;
          needsPicker?: boolean;
        };
        if (isAdminContext) {
          const allowed = await assertAdminAccess();
          router.push(allowed ? adminDestination : routes.adminUnauthorized);
          router.refresh();
          return;
        }
        if (provisioned.nextPath === routes.clientes || provisioned.needsPicker) {
          router.push(routes.clientes);
          router.refresh();
          return;
        }
        const destination = resolveSafeNextPath(
          searchParams.get("next"),
          routes.overview,
        );
        router.push(destination);
        router.refresh();
        return;
      } catch {
        // El link Hecom se puede reintentar; no bloquear login.
      }
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
              "Te enviamos un nuevo código y enlace mágico. El código anterior ya no sirve.",
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
      <div className="mb-7">
        <h1 className="font-display text-[1.65rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.85rem]">
          {isHecomFlow ? "Código o enlace" : "Verificá tu correo"}
        </h1>
        <p className="mt-2 text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
          {isHecomFlow ? (
            <>
              Escribí el código de 6 dígitos enviado a{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                {email || "tu correo"}
              </span>
              , o abrí el enlace mágico del mismo email.
            </>
          ) : (
            <>
              Introducí el código de 6 dígitos enviado a{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                {email || "tu correo"}
              </span>
            </>
          )}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label
            htmlFor="otp"
            className="mb-2 block text-[13px] font-medium text-[var(--auth-text)]"
          >
            Código de verificación
          </label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            className={inputClassName}
          />
        </div>

        {error && (
          <p
            className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[14px] font-medium leading-5 text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[14px] font-medium leading-5 text-emerald-800"
            role="status"
          >
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-[var(--auth-accent)] text-[15px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.04] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
        >
          {loading ? "Verificando…" : "Verificar y continuar"}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-center text-[14px]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className={cn(
            "font-semibold text-[var(--auth-accent)] transition-colors hover:brightness-110 disabled:opacity-50",
          )}
        >
          {resending
            ? "Reenviando…"
            : resendCooldown > 0
              ? `Reenviar en ${resendCooldown}s`
              : "Reenviar código y enlace"}
        </button>
        {isHecomFlow ? (
          <p className="text-[12px] leading-5 text-[var(--auth-text-soft)]">
            Si pedís otro código, usá solo el más reciente del correo.
          </p>
        ) : null}
        <p className="text-[var(--auth-text-muted)]">
          <Link
            href={isAdminContext ? routes.adminLogin : routes.login}
            className="font-medium text-[var(--auth-text-soft)] transition-colors hover:text-[var(--auth-text)]"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
