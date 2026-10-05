"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@/config/routes";
import { mapAuthErrorMessage } from "@/lib/auth/error-messages.client";
import { AuthFormHeading, AuthNotice, AuthSubmitButton } from "./AuthFormUi";
import styles from "./auth.module.css";
import { getAuthCopy, type AuthCopy } from "../i18n/auth-copy";
import type { LandingLocale } from "@/features/landing/i18n/landing-locale";

interface RegisterFormValues {
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
  email: string;
}

/** Hecom guarda un solo campo `name`: la UI separa, el envío vuelve a unir. */
function joinFullName(values: RegisterFormValues): string {
  return `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
}

const inputClassName = "auth-field";

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[var(--auth-text-soft)]"
      aria-hidden
    >
      {children}
    </span>
  );
}

function readStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem("vv_referral_code");
  return value && value.trim() ? value.trim() : null;
}

function persistReferralCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("vv_referral_code", code);
  document.cookie = `vv_referral_code=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

async function trackReferralClick(code: string): Promise<void> {
  try {
    await fetch("/api/affiliates/track-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, event: "click" }),
    });
  } catch {
    // El tracking no debe bloquear el registro.
  }
}

function validateForm(
  values: RegisterFormValues,
  t: AuthCopy["register"],
): string | null {
  if (values.firstName.trim().length < 2) {
    return t.errFirstName;
  }
  if (values.lastName.trim().length < 2) {
    return t.errLastName;
  }
  const dni = values.dni.trim().replace(/\D/g, "");
  if (!/^\d{8}$/.test(dni)) {
    return t.errDni;
  }
  const phoneDigits = values.phone.replace(/\D/g, "");
  if (phoneDigits.length < 9) {
    return t.errPhone;
  }
  if (!values.email.trim().includes("@")) {
    return t.errEmail;
  }
  return null;
}

export function RegisterForm({ locale = "es" }: { locale?: LandingLocale }) {
  const t = getAuthCopy(locale).register;
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref")?.trim() || null;
  // Slug del aliado cuando llega desde su landing (/a/<slug> → /register?a=<slug>).
  const partnerSlug = searchParams.get("a")?.trim().toLowerCase() || null;
  const fromLogin = searchParams.get("from") === "login";
  const [values, setValues] = useState<RegisterFormValues>({
    firstName: "",
    lastName: "",
    dni: "",
    phone: "",
    email: searchParams.get("email")?.trim() ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!referralCode) return;
    persistReferralCode(referralCode);
    void trackReferralClick(referralCode);
  }, [referralCode]);

  function updateField<K extends keyof RegisterFormValues>(
    key: K,
    value: RegisterFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateForm(values, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {

      const response = await fetch(routes.api.auth.otpRegister, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Mismo payload que antes: Hecom sigue recibiendo un `name` completo.
          name: joinFullName(values),
          dni: values.dni.trim().replace(/\D/g, ""),
          phone: values.phone.trim(),
          email: values.email.trim(),
          // Se guardan al crear el cliente: el usuario recién existe tras el OTP.
          referralCode: referralCode ?? readStoredReferralCode(),
          partner: partnerSlug,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        email?: string;
        retryAfterSec?: number;
      };

      if (!response.ok) {
        setError(
          payload.error ? mapAuthErrorMessage(payload.error, locale) : t.failed,
        );
        setLoading(false);
        return;
      }

      const canonicalEmail =
        payload.email?.trim() || values.email.trim().toLowerCase();

      const verifyUrl = new URL(routes.verifyOtp, window.location.origin);
      verifyUrl.searchParams.set("email", canonicalEmail);
      verifyUrl.searchParams.set("flow", "hecom");
      verifyUrl.searchParams.set("sent", "1");
      verifyUrl.searchParams.set("from", "register");
      if (payload.retryAfterSec) {
        verifyUrl.searchParams.set("cooldown", String(payload.retryAfterSec));
      }
      if (payload.message) {
        verifyUrl.searchParams.set("hint", payload.message);
      }
      const nextPath = searchParams.get("next");
      if (nextPath) verifyUrl.searchParams.set("next", nextPath);

      router.push(`${verifyUrl.pathname}${verifyUrl.search}`);
      router.refresh();
    } catch {
      setError(t.failedRetry);
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <AuthFormHeading title={t.title}>{t.subtitle}</AuthFormHeading>

      <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
        {fromLogin && (
          <AuthNotice tone="info">{t.notRegisteredNotice}</AuthNotice>
        )}

        <div className={styles.twoColumns}>
          <div className={styles.fieldGroup}>
            <label
              htmlFor="firstName"
              className={styles.fieldLabel}
            >
              {t.firstName}
            </label>
            <div className="relative">
              <FieldIcon>
                <svg className="h-4 w-4" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </FieldIcon>
              <input
                id="firstName"
                autoComplete="given-name"
                required
                value={values.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                placeholder={t.firstNamePlaceholder}
                className={inputClassName}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label
              htmlFor="lastName"
              className={styles.fieldLabel}
            >
              {t.lastName}
            </label>
            <div className="relative">
              <FieldIcon>
                <svg className="h-4 w-4" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </FieldIcon>
              <input
                id="lastName"
                autoComplete="family-name"
                required
                value={values.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                placeholder={t.lastNamePlaceholder}
                className={inputClassName}
              />
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label
            htmlFor="dni"
            className={styles.fieldLabel}
          >
            {t.dni}
          </label>
          <div className="relative">
            <FieldIcon>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </FieldIcon>
            <input
              id="dni"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={8}
              pattern="[0-9]{8}"
              value={values.dni}
              onChange={(event) =>
                updateField(
                  "dni",
                  event.target.value.replace(/\D/g, "").slice(0, 8),
                )
              }
              placeholder={t.dniPlaceholder}
              className={inputClassName}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label
            htmlFor="phone"
            className={styles.fieldLabel}
          >
            {t.phone}
          </label>
          <div className="relative">
            <FieldIcon>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </FieldIcon>
            <div className="pointer-events-none absolute left-11 top-1/2 z-[1] -translate-y-1/2 text-[13px] font-semibold text-[var(--auth-text-muted)]">
              +51
            </div>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={values.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="987 654 321"
              className={`${inputClassName} auth-field--phone`}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label
            htmlFor="email"
            className={styles.fieldLabel}
          >
            {t.email}
          </label>
          <div className="relative">
            <FieldIcon>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </FieldIcon>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder={t.emailPlaceholder}
              className={inputClassName}
            />
          </div>
        </div>

        {referralCode && (
          <AuthNotice tone="info">
            {t.referral}{" "}
            <span className="font-semibold text-[var(--auth-text)]">
              {referralCode}
            </span>
          </AuthNotice>
        )}

        {error && (
          <AuthNotice tone="error" id="register-error">{error}</AuthNotice>
        )}

        <AuthSubmitButton loading={loading} loadingLabel={t.creating}>
          {t.create}
        </AuthSubmitButton>
      </form>

      <p className={styles.formFooter}>
        {t.haveAccount}{" "}
        <Link
          href={routes.login}
          className={styles.textLink}
        >
          {t.signIn}
        </Link>
      </p>
    </div>
  );
}
