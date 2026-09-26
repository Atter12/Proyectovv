import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, InputHTMLAttributes } from "react";

export const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)] outline-none transition-colors duration-150 placeholder:text-[var(--admin-text-soft)] focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent)]/20";

export const areaClass =
  "min-h-24 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)] outline-none transition-colors duration-150 placeholder:text-[var(--admin-text-soft)] focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent)]/20";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className ?? "block"}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  className,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} className={className}>
      <input className={fieldClass} {...props} />
    </Field>
  );
}

export function AreaField({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label}>
      <textarea className={areaClass} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} className={className}>
      <select className={fieldClass} {...props}>
        {children}
      </select>
    </Field>
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
