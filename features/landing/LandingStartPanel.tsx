import Link from "next/link";
import { routes } from "@/config/routes";

/** Panel derecho — estética SaaS limpia (Rockads-like) + Holistic. */
export function LandingStartPanel() {
  return (
    <div className="auth-panel auth-enter relative w-full max-w-[420px] overflow-hidden rounded-[1.25rem] p-8 sm:p-9 lg:max-w-none">
      <div className="mb-8">
        <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
          Acceso
        </p>
        <h2 className="mt-2 text-[1.85rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2rem]">
          Empezar en Holistic
        </h2>
        <p className="mt-2 text-[15px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Recargá la cartera, asigná a TikTok y operá campañas en un solo panel.
        </p>
      </div>

      <ol className="mb-8 space-y-4">
        {[
          { n: "01", t: "Recargar cartera" },
          { n: "02", t: "Asignar a cuentas ads" },
          { n: "03", t: "Gastar en campañas" },
        ].map((step) => (
          <li key={step.n} className="flex items-center gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[12px] font-bold text-[var(--auth-accent)]">
              {step.n}
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--auth-text)]">
              {step.t}
            </span>
          </li>
        ))}
      </ol>

      <div className="space-y-3">
        <Link
          href={routes.register}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] text-[15px] font-bold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
        >
          Crear cuenta
        </Link>
        <Link
          href={routes.login}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--auth-control-border)] bg-white text-[15px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
        >
          Iniciar sesión
        </Link>
      </div>

      <p className="mt-6 text-center text-[13px] font-medium text-[var(--auth-text-soft)]">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={routes.login}
          className="font-bold text-[var(--auth-accent)] underline-offset-2 hover:underline"
        >
          Entrá acá
        </Link>
      </p>
    </div>
  );
}
