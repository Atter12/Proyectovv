"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function CrmQuickLinks({
  links,
}: {
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  const t = useTranslations("nav");

  return (
    <nav
      className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]"
      aria-label={t("quickAccessAria")}
    >
      <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
        {t("quickAccess")}
      </span>
      {links.map((link, index) => (
        <span key={link.href} className="inline-flex items-center">
          {index > 0 ? (
            <span className="mx-2 text-[var(--auth-text-soft)]" aria-hidden>
              ·
            </span>
          ) : null}
          <Link
            href={link.href}
            className="font-medium text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
          >
            {link.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
