import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function ChevronDisc({ className }: { className?: string }) {
  return (
    <span className={cn("nsx-btn-icon", className)} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M5 3.5L8.5 7 5 10.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2.5 3.5L6 7 2.5 10.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
      </svg>
    </span>
  );
}

export function NsxBtnPrimary({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <a href={href} className={cn("nsx-btn nsx-btn-primary", className)}>
      <ChevronDisc />
      <span>{children}</span>
    </a>
  );
}

export function NsxBtnSecondary({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <a href={href} className={cn("nsx-btn nsx-btn-secondary", className)}>
      <ChevronDisc />
      <span>{children}</span>
    </a>
  );
}
