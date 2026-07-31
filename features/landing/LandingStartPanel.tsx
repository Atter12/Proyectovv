import Link from "next/link";
import { routes } from "@/config/routes";

/** Panel derecho estilo login — CTAs en vez del formulario. */
export function LandingStartPanel() {
  return (
    <div className="auth-panel auth-enter relative w-full max-w-[420px] overflow-hidden rounded-2xl p-7 sm:p-8 lg:max-w-none">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--auth-accent)]/55 to-transparent"
        aria-hidden
      />

      <div className="mb-7">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
          Acceso
        </p>
        <h2 className="font-display mt-2.5 text-[2rem] font-medium italic leading-[1.1] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.15rem]">
          Empezar en Holistic
        </h2>
        <p className="font-sans mt-2.5 text-[15px] font-medium leading-6 tracking-[-0.01em] text-[var(--auth-text-muted)]">
          Recargá la cartera, asigná a TikTok y operá campañas en un solo panel.
        </p>
      </div>

      <ol className="mb-7 space-y-3">
        {[
          { n: "01", t: "Recargar cartera" },
          { n: "02", t: "Asignar a cuentas ads" },
          { n: "03", t: "Gastar en campañas" },
        ].map((step) => (
          <li key={step.n} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--auth-accent)] text-[11px] font-bold text-white shadow-[0_8px_18px_rgb(255_120_31_/_0.28)]">
              {step.n}
            </span>
            <span className="text-[14px] font-semibold text-[var(--auth-text)]">
              {step.t}
            </span>
          </li>
        ))}
      </ol>

      <div className="space-y-3">
        <Link
          href={routes.register}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(105deg,var(--brand-coral),var(--brand-primary)_50%,var(--brand-accent))] text-[15px] font-semibold text-white shadow-[0_10px_26px_rgb(255_120_31_/_0.22)] transition-[filter,box-shadow,transform] hover:brightness-[1.05] hover:shadow-[0_12px_28px_rgb(255_120_31_/_0.28)] active:translate-y-px"
        >
          Crear cuenta
        </Link>
        <Link
          href={routes.login}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--auth-control-border)] bg-[var(--auth-control-bg)] text-[15px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
        >
          Iniciar sesión
        </Link>
      </div>

      <p className="mt-6 text-center text-[13px] text-[var(--auth-text-soft)]">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={routes.login}
          className="font-semibold text-[var(--auth-accent)] underline-offset-2 hover:underline"
        >
          Entrá acá
        </Link>
      </p>
    </div>
  );
}
