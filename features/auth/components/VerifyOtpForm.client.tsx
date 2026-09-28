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
import { localizeAuthNotice, mapAuthErrorMessage } from "@/lib/auth/error-messages.client";
import { getAuthCopy } from "../i18n/auth-copy";
import type { LandingLocale } from "@/features/landing/i18n/landing-locale";
import {
  HECOM_OTP_COOLDOWN_SECONDS,
  normalizeHecomOtpEmail,
} from "@/lib/auth/hecom-otp-email";
import { resolveSafeNextPath } from "@/lib/auth/safe-next-path";

async function assertAdminAccess(): Promise<boolean> {
  const response = await fetch(routes.api.auth.adminAccess, { cache: "no-store" });
  return response.ok;
}

export function VerifyOtpForm({ locale = "es" }: { locale?: LandingLocale }) {
  const t = getAuthCopy(locale).verify;
  const router = useRouter();
  const searchParams = useSearchParams();
  const hintParam = searchParams.get("hint");
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
    hintParam ? localizeAuthNotice(hintParam, locale) : null,
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
      setError(t.missingEmailBack);
      setLoading(false);
      return;
    }

    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(code)) {
      setError(t.invalidCode);
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
            payload.error ? mapAuthErrorMessage(payload.error, locale) : t.verifyFailed,
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
        setError(t.verifyNetwork);
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
        setError(mapAuthErrorMessage(verifyError.message, locale));
        setLoading(false);
        return;
      }
    } catch {
      setError(t.verifyNetwork);
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
      setError(t.missingEmail);
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
          setError(payload.error ? mapAuthErrorMessage(payload.error, locale) : t.resendFailed);
        } else {
          applyResendCooldown(payload.retryAfterSec);
          setOtp("");
          setSuccess(
            payload.message ? localizeAuthNotice(payload.message, locale) : t.resentHecom,
          );
        }
      } catch {
        setError(t.resendFailedCode);
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
      setError(mapAuthErrorMessage(resendError.message, locale));
    } else {
      setSuccess(t.resentOther);
    }
    setResending(false);
  }

  return (
    <div className="w-full">
      <AuthFormHeading title={t.title}>
        {t.sentTo}
        <strong className={styles.destinationEmail}>
          {email || t.yourEmail}
        </strong>
      </AuthFormHeading>

      <form onSubmit={handleVerify} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label htmlFor="otp" className={styles.fieldLabel}>
            {t.codeLabel}
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
            {isHecomFlow ? t.helpHecom : t.helpOther}
          </p>
        </div>

        {error && (
          <AuthNotice tone="error" id="otp-error">{error}</AuthNotice>
        )}

        {success && (
          <AuthNotice tone="success">{success}</AuthNotice>
        )}

        <AuthSubmitButton loading={loading} loadingLabel={t.verifying}>
          {t.verify}
        </AuthSubmitButton>
      </form>

      <div className={styles.formFooter}>
        <p className={styles.muted}>{t.checkSpam}</p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className={styles.secondaryButton}
        >
          {resending
            ? t.resending
            : resendCooldown > 0
              ? t.resendIn(resendCooldown)
              : t.resend}
        </button>
        {isHecomFlow ? (
          <p className={styles.helpText}>
            {t.useLatest}
          </p>
        ) : null}
        <p>
          <Link
            href={isAdminContext ? routes.adminLogin : routes.login}
            className={styles.textLink}
          >
            {t.useOtherEmail}
          </Link>
        </p>
      </div>
    </div>
  );
}
