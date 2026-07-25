import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

interface InfoAlertProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export function InfoAlert({
  title = "Información",
  children,
  className,
  ...props
}: InfoAlertProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--admin-accent-soft)] p-4",
        className,
      )}
      {...props}
    >
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-primary-deep)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#141210]">{title}</p>
        {children ? (
          <div className="mt-1 text-sm text-[#6b645c]">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
