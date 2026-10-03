import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import styles from "./auth.module.css";
import { getAuthCopy } from "../i18n/auth-copy";
import {
  landingLocaleHtmlLang,
  type LandingLocale,
} from "@/features/landing/i18n/landing-locale";
import { LandingLocaleSwitcher } from "@/features/landing/i18n/LandingLocaleSwitcher.client";
import { AuthLiveCompact } from "./AuthLivePreview.client";
import { AuthRechargeDemo } from "./AuthRechargeDemo.client";

interface AuthSplitShellProps {
  children: React.ReactNode;
  caption: { title: string; sub?: string };
  topRight: { label: string; href: string; prompt?: string };
  accountLinkPosition?: "top" | "bottom";
  /** Si se pasa, muestra el selector de idioma y traduce el shell. */
  locale?: LandingLocale;
  /** Tarjeta «en vivo» arriba del formulario en celular (login y registro). */
  liveCompact?: boolean;
}

function BrandLogo({ className, homeAria }: { className?: string; homeAria: string }) {
  return (
    <Link href={routes.home} aria-label={`${siteConfig.name} — ${homeAria}`} className={className}>
      <Image src="/brand/holistic-marketing-logo.png" alt={siteConfig.name} width={506} height={187} sizes="(min-width: 1024px) 204px, 136px" className={styles.logo} />
    </Link>
  );
}

/** Shared canvas for the entire public authentication journey. */
export function AuthSplitShell({ children, caption, topRight, accountLinkPosition = "top", locale, liveCompact = false }: AuthSplitShellProps) {
  const shellCopy = getAuthCopy(locale ?? "es").shell;
  const accountLink = (
    <div className={`${styles.accountLink} ${accountLinkPosition === "bottom" ? styles.accountLinkBottom : ""}`}>
      {topRight.prompt ? <span className={styles.accountPrompt}>{topRight.prompt}</span> : null}
      <Link href={topRight.href} className={styles.topLink}>{topRight.label}</Link>
    </div>
  );

  return (
    <div className={`auth-shell ${styles.shell}`} lang={locale ? landingLocaleHtmlLang[locale] : undefined}>
      <a href="#auth-content" className={styles.skipLink}>{shellCopy.skipToForm}</a>
      <aside className={styles.brandPanel} aria-label="Ads Holistic">
        <AuthRechargeDemo locale={locale ?? "es"} caption={caption} />
        <div className={styles.brandContent}>
          <BrandLogo className={styles.brandLink} homeAria={shellCopy.homeAria} />
        </div>
      </aside>
      <div className={styles.formPanel}>
        <header className={styles.topbar}>
          <BrandLogo className={styles.mobileBrand} homeAria={shellCopy.homeAria} />
          <div className="ml-auto flex items-center gap-2">
            {locale ? <LandingLocaleSwitcher locale={locale} label={shellCopy.language} /> : null}
            {accountLinkPosition === "top" ? accountLink : null}
          </div>
        </header>
        <main id="auth-content" className={styles.main} tabIndex={-1}>
          <div className={styles.formContent}>
            {liveCompact ? <AuthLiveCompact locale={locale ?? "es"} /> : null}
            {children}
            {accountLinkPosition === "bottom" ? accountLink : null}
          </div>
        </main>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} {siteConfig.companyName}</span>
        </footer>
      </div>
    </div>
  );
}
