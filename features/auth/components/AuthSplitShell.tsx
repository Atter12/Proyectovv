import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import styles from "./auth.module.css";

interface AuthSplitShellProps {
  children: React.ReactNode;
  caption: { title: string; sub?: string };
  topRight: { label: string; href: string; prompt?: string };
  accountLinkPosition?: "top" | "bottom";
  imagePosition?: string;
}

function BrandLogo({ className }: { className?: string }) {
  return (
    <Link href={routes.home} aria-label={`${siteConfig.name} — inicio`} className={className}>
      <Image src="/brand/holistic-marketing-logo.png" alt={siteConfig.name} width={506} height={187} sizes="(min-width: 1024px) 204px, 136px" className={styles.logo} />
    </Link>
  );
}

/** Shared canvas for the entire public authentication journey. */
export function AuthSplitShell({ children, caption, topRight, accountLinkPosition = "top", imagePosition = "50% 0%" }: AuthSplitShellProps) {
  const accountLink = (
    <div className={`${styles.accountLink} ${accountLinkPosition === "bottom" ? styles.accountLinkBottom : ""}`}>
      {topRight.prompt ? <span className={styles.accountPrompt}>{topRight.prompt}</span> : null}
      <Link href={topRight.href} className={styles.topLink}>{topRight.label}</Link>
    </div>
  );

  return (
    <div className={`auth-shell ${styles.shell}`}>
      <a href="#auth-content" className={styles.skipLink}>Ir al formulario</a>
      <aside className={styles.brandPanel} aria-label="Ads Holistic">
        <div className={styles.brandMedia}>
          <Image src="/auth/holistic-studio-access.png" alt="" fill sizes="(min-width: 1024px) 52vw, 1px" loading="eager" fetchPriority="high" className={styles.brandArt} style={{ objectPosition: imagePosition }} />
        </div>
        <div className={styles.brandContent}>
          <BrandLogo className={styles.brandLink} />
          <p className={styles.brandCaption}>{caption.title}</p>
        </div>
      </aside>
      <div className={styles.formPanel}>
        <header className={styles.topbar}>
          <BrandLogo className={styles.mobileBrand} />
          {accountLinkPosition === "top" ? accountLink : null}
        </header>
        <main id="auth-content" className={styles.main} tabIndex={-1}>
          <div className={styles.formContent}>
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
