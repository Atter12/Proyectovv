"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { localizeAuthNotice, mapAuthErrorMessage } from "@/lib/auth/error-messages.client";
import { AuthFormHeading, AuthNotice, AuthSubmitButton } from "./AuthFormUi";
import styles from "./auth.module.css";
import { getAuthCopy } from "../i18n/auth-copy";
import type { LandingLocale } from "@/features/landing/i18n/landing-locale";

function PasswordToggle({
  visible,
  onToggle,
  showLabel,
  hideLabel,
}: {
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--auth-text-soft)] transition-colors hover:bg-[var(--auth-control-hover)] hover:text-[var(--auth-text)]"
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
    >
      {visible ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
    </button>
  );
}

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

const inputClassName = "auth-field";

interface LoginFormProps {
  hecomOtpEnabled?: boolean;
  locale?: LandingLocale;
}

/**
 * Login Holistic — mismo lenguaje visual que Registrarme + lookup por nombre.
 */
export function LoginForm({ hecomOtpEnabled = false, locale = "es" }: LoginFormProps) {
  const t = getAuthCopy(locale).login;
  const router = useRouter();
  const searchParams = useSearchParams();
  const otpMode = hecomOtpEnabled;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupName, setLookupName] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupHint, setLookupHint] = useState<string | null>(null);
  const [lookupMatches, setLookupMatches] = useState<
    Array<{ name: string; email: string; emailMasked: string }>
  >([]);

  async function handleLookup() {
    setLookupLoading(true);
    setLookupError(null);
    setLookupHint(null);
    setLookupMatches([]);

    try {
      const response = await fetch(routes.api.auth.otpLookupEmail, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: lookupName.trim() }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        matches?: Array<{ name: string; email: string; emailMasked: string }>;
      };

      if (!response.ok) {
        setLookupError(
          payload.error ? mapAuthErrorMessage(payload.error, locale) : t.lookupFailed,
        );
        setLookupLoading(false);
        return;
      }

      setLookupMatches(payload.matches ?? []);
      setLookupHint(payload.message ? localizeAuthNotice(payload.message, locale) : null);
      setLookupLoading(false);
    } catch {
      setLookupError(t.lookupRetry);
      setLookupLoading(false);
    }
  }

  function applyLookupEmail(nextEmail: string) {
    setEmail(nextEmail);
    setLookupOpen(false);
    setLookupError(null);
    setLookupHint(null);
    setLookupMatches([]);
    setError(null);
  }

  async function handleOtpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(routes.api.auth.otpRequest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        email?: string;
        retryAfterSec?: number;
        notRegistered?: boolean;
      };

      if (response.ok && payload.notRegistered) {
        // Correo sin cuenta: no llega código. Lo llevamos a crear la cuenta.
        const registerUrl = new URL(routes.register, window.location.origin);
        registerUrl.searchParams.set("email", email.trim().toLowerCase());
        registerUrl.searchParams.set("from", "login");
        router.push(`${registerUrl.pathname}${registerUrl.search}`);
        return;
      }

      if (!response.ok) {
        setError(
          payload.error ? mapAuthErrorMessage(payload.error, locale) : t.sendFailed,
        );
        setLoading(false);
        return;
      }

      const canonicalEmail =
        payload.email?.trim() || email.trim().toLowerCase();

      const verifyUrl = new URL(routes.verifyOtp, window.location.origin);
      verifyUrl.searchParams.set("email", canonicalEmail);
      verifyUrl.searchParams.set("flow", "hecom");
      verifyUrl.searchParams.set("sent", "1");
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
      setError(t.sendRetry);
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(mapAuthErrorMessage(signInError.message, locale));
      setLoading(false);
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
      router.push(
        `${routes.verifyOtp}?email=${encodeURIComponent(email.trim())}`,
      );
      router.refresh();
      return;
    }

    const nextPath = searchParams.get("next");
    const destination =
      nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
        ? nextPath
        : routes.overview;

    router.push(destination);
    router.refresh();
  }

  const magicError = searchParams.get("error") === "magic_link";

  return (
    <div className="w-full">
      <div className={styles.loginHeading}>
        <AuthFormHeading title={t.title}>
          {otpMode ? t.subtitleOtp : t.subtitlePassword}
        </AuthFormHeading>
      </div>

      <form
        onSubmit={otpMode ? handleOtpSubmit : handlePasswordSubmit}
        className={styles.form}
        aria-busy={loading}
      >
        <div>
          <label
            htmlFor="email"
            className={styles.fieldLabel}
          >
            {t.emailLabel}
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
              name="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.emailPlaceholder}
              className={inputClassName}
              disabled={loading}
            />
          </div>
          {otpMode ? (
            <button
              type="button"
              onClick={() => {
                setLookupOpen((open) => !open);
                setLookupError(null);
                setLookupHint(null);
              }}
              className={`${styles.textLink} ${styles.lookupToggle}`}
              aria-expanded={lookupOpen}
              aria-controls="email-lookup"
            >
              {t.forgotEmail}
            </button>
          ) : null}
        </div>

        {otpMode && lookupOpen ? (
          <div id="email-lookup" className={styles.lookupPanel}>
            <p className={styles.lookupPanelTitle}>
              {t.lookupTitle}
            </p>
            <p className={`${styles.helpText} mt-1`}>
              {t.lookupHelp}
            </p>
            <div className="mt-3.5 space-y-3">
              <div className="relative">
                <FieldIcon>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </FieldIcon>
                <input
                  id="lookup-name"
                  aria-label={t.lookupAria}
                  autoComplete="name"
                  minLength={4}
                  value={lookupName}
                  onChange={(event) => setLookupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (lookupName.trim().length >= 4 && !lookupLoading) {
                        void handleLookup();
                      }
                    }
                  }}
                  placeholder={t.lookupPlaceholder}
                  className={inputClassName}
                />
              </div>

              {lookupError ? (
                <p className="text-[13px] font-medium text-red-700" role="alert">
                  {lookupError}
                </p>
              ) : null}
              {lookupHint && lookupMatches.length === 0 ? (
                <p className="text-[13px] font-medium text-[var(--auth-text-muted)]">
                  {lookupHint}
                </p>
              ) : null}

              {lookupMatches.length > 0 ? (
                <ul className="space-y-2">
                  {lookupMatches.map((match) => (
                    <li key={`${match.email}-${match.name}`}>
                      <button
                        type="button"
                        onClick={() => applyLookupEmail(match.email)}
                        className={styles.lookupMatch}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-[var(--auth-text)]">
                            {match.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-[var(--auth-text-muted)]">
                            {match.emailMasked}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] font-bold text-[var(--auth-accent)]">
                          {t.lookupUse}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={lookupLoading || lookupName.trim().length < 4}
                className={`${styles.secondaryButton} w-full`}
              >
                {lookupLoading ? t.lookupSearching : t.lookupSearch}
              </button>
            </div>
          </div>
        ) : null}

        {!otpMode && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className={styles.fieldLabel}
              >
                {t.passwordLabel}
              </label>
              <Link
                href={routes.forgotPassword}
                className={styles.textLink}
              >
                {t.forgotPassword}
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.passwordPlaceholder}
                className={cn(inputClassName, styles.passwordField)}
              />
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
              />
            </div>
          </div>
        )}

        {(error || magicError) && (
          <AuthNotice tone="error">
            {error ?? t.magicLinkExpired}
          </AuthNotice>
        )}

        <AuthSubmitButton loading={loading} loadingLabel={otpMode ? t.sendingCode : t.signingIn}>
          {otpMode ? t.getCode : t.signIn}
        </AuthSubmitButton>
      </form>

      {!otpMode ? (
        <p className={styles.formFooter}>
          {t.troubles}{" "}
          <Link
            href={routes.forgotPassword}
            className={styles.textLink}
          >
            {t.recoverAccess}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
