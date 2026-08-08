import Link from "next/link";
import { routes } from "@/config/routes";
import { NsxBtnPrimary, NsxBtnSecondary } from "./NsxButtons";
import { NsxReveal } from "./NsxReveal.client";

export function NsxCta() {
  return (
    <section className="nsx-section border-t border-[var(--nsx-stroke)] bg-white">
      <div className="nsx-container">
        <div className="mx-auto max-w-[40rem] space-y-6 text-center">
          <NsxReveal delayMs={40}>
            <span className="nsx-badge">Get started</span>
          </NsxReveal>
          <NsxReveal delayMs={100}>
            <h2 className="nsx-h2">Ready to automate your workflows?</h2>
          </NsxReveal>
          <NsxReveal delayMs={150}>
            <p className="text-[var(--nsx-muted)]">
              Join 2,000+ teams shipping faster with Nexsas. Start free, connect
              your stack, and remove the manual busywork.
            </p>
          </NsxReveal>
          <NsxReveal delayMs={200}>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <NsxBtnPrimary href={routes.register}>Start free trial</NsxBtnPrimary>
              <NsxBtnSecondary href={routes.login}>Book demo</NsxBtnSecondary>
            </div>
          </NsxReveal>
        </div>
      </div>
    </section>
  );
}

export function NsxFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="nsx-footer">
      <div className="nsx-container flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nexsas/automation/logo/main-logo.svg"
            alt="Nexsas"
            width={140}
            height={36}
            className="h-9 w-auto"
          />
          <span className="rounded-full bg-[var(--nsx-lime)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--nsx-secondary)]">
            Automation SaaS
          </span>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-[var(--nsx-muted)]">
          <Link href={routes.login} className="hover:text-[var(--nsx-secondary)]">
            Login
          </Link>
          <Link href={routes.register} className="hover:text-[var(--nsx-secondary)]">
            Sign up free
          </Link>
          <a href="#features" className="hover:text-[var(--nsx-secondary)]">
            Features
          </a>
        </div>
        <p className="text-xs text-[var(--nsx-muted)]">
          © {year} Nexsas. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
