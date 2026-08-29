"use client";

import { cn } from "@/lib/cn";

const STEPS = [
  { id: "upload", label: "Subir", hint: "Pieza" },
  { id: "score", label: "Score IA", hint: "Como AdCreative" },
  { id: "brief", label: "Brief", hint: "Agent Pro" },
  { id: "launch", label: "Aprobar", hint: "Vos decidís" },
] as const;

export function CreativePipelineStrip({
  activeStep,
}: {
  /** 0=upload, 1=score, 2=brief, 3=launch */
  activeStep: 0 | 1 | 2 | 3;
}) {
  return (
    <nav
      aria-label="Flujo creativo"
      className="overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[linear-gradient(135deg,#fffaf6_0%,#ffffff_55%,#f7faf8_100%)] px-3 py-3.5 sm:px-5"
    >
      <ol className="grid grid-cols-4 gap-1 sm:gap-2">
        {STEPS.map((step, index) => {
          const done = index < activeStep;
          const current = index === activeStep;
          return (
            <li key={step.id} className="relative min-w-0 text-center">
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(50%+14px)] right-[calc(-50%+14px)] top-[14px] hidden h-px sm:block",
                    done || current
                      ? "bg-[rgb(255_120_31_/_0.45)]"
                      : "bg-[rgb(20_18_16_/_0.1)]",
                  )}
                />
              ) : null}
              <div className="relative z-[1] flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-colors",
                    done
                      ? "bg-[var(--auth-accent)] text-white"
                      : current
                        ? "bg-[rgb(255_120_31_/_0.15)] text-[var(--auth-accent)] ring-2 ring-[rgb(255_120_31_/_0.35)]"
                        : "bg-[rgb(20_18_16_/_0.05)] text-[var(--auth-text-soft)]",
                  )}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-[11px] font-semibold tracking-[-0.01em] sm:text-[12px]",
                    current
                      ? "text-[var(--auth-text)]"
                      : "text-[var(--auth-text-muted)]",
                  )}
                >
                  {step.label}
                </span>
                <span className="hidden truncate text-[10px] text-[var(--auth-text-soft)] sm:block">
                  {step.hint}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
