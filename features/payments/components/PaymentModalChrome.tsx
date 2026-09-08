import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PaymentModalHeaderProps {
  titleId: string;
  title: string;
  description: string;
  identityIcon: ReactNode;
  identityLabel: string;
  identityDescription: string;
  steps: readonly string[];
  currentStep: number;
  onClose: () => void;
}

export function PaymentModalHeader({
  titleId,
  title,
  description,
  identityIcon,
  identityLabel,
  identityDescription,
  steps,
  currentStep,
  onClose,
}: PaymentModalHeaderProps) {
  return (
    <header className="border-b border-[#eee8e2] bg-[#fffaf6] px-5 pb-5 pt-5 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {identityIcon}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#1c1917]">
              {identityLabel}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#6f675f]">
              {identityDescription}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e7dfd7] bg-white text-[#6f675f] transition-colors hover:bg-[#f7f2ed] hover:text-[#1c1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf6]"
          aria-label="Cerrar"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mt-5 max-w-[38rem]">
        <h2
          id={titleId}
          className="text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-[#171412]"
        >
          {title}
        </h2>
        <p className="mt-1.5 max-w-[62ch] text-[13px] leading-5 text-[#625b54]">
          {description}
        </p>
      </div>

      <ol
        className="mt-5 grid grid-cols-3 gap-2"
        aria-label="Progreso del pago"
      >
        {steps.map((step, index) => {
          const reached = index <= currentStep;
          const current = index === currentStep;
          return (
            <li key={step} aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "block h-1 rounded-full transition-colors",
                  reached ? "bg-[#ff781f]" : "bg-[#e5ddd5]",
                )}
              />
              <span
                className={cn(
                  "mt-1.5 block text-[10px] font-semibold",
                  current
                    ? "text-[#1c1917]"
                    : reached
                      ? "text-[#c65113]"
                      : "text-[#8a8177]",
                )}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

export function PaymentModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 border-t border-[#eee8e2] pt-4 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
      <path
        d="m7.5 12.5 3 3 6.5-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="m6 6 8 8m0-8-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
