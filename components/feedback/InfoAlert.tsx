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
        "flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4",
        className,
      )}
      {...props}
    >
      <div className="mt-0.5 shrink-0">
        <svg
          className="h-5 w-5 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-indigo-900">{title}</p>
        {children && (
          <div className="mt-1 text-sm text-indigo-800/80">{children}</div>
        )}
      </div>
    </div>
  );
}
