import { forwardRef, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)] outline-none transition-colors duration-150 placeholder:text-[var(--admin-text-soft)] focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent)]/20";

export const areaClass =
  "min-h-24 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)] outline-none transition-colors duration-150 placeholder:text-[var(--admin-text-soft)] focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent)]/20";

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">
        {label}
        {required ? <span className="text-[var(--admin-accent)]"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-[var(--admin-text-soft)]">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  hint,
  className,
  required,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} required={required} className={className}>
      <input className={fieldClass} required={required} {...props} />
    </Field>
  );
}

export const AreaField = forwardRef<
  HTMLTextAreaElement,
  { label: string; hint?: string; className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AreaField({ label, hint, className, ...props }, ref) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea ref={ref} className={areaClass} {...props} />
    </Field>
  );
});

export function SelectField({
  label,
  hint,
  children,
  className,
  ...props
}: { label: string; hint?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select className={fieldClass} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-soft)]">
      <div className="flex items-start gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--admin-accent)] text-[0.6875rem] font-semibold text-white">
          {step}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-[var(--admin-text-muted)]">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-badge-danger-bg)] px-3 py-2 text-sm text-[var(--admin-badge-danger-text)]" role="alert">
      {message}
    </p>
  );
}
