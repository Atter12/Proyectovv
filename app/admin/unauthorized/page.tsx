import { signOutAdminAction } from "@/app/actions/admin-auth";
import { routes } from "@/config/routes";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <main className="auth-canvas grid min-h-screen place-items-center px-4 py-10">
      <div className="auth-panel w-full max-w-xl rounded-2xl p-8 text-center sm:p-10">
        <div className="mb-6 flex justify-center">
          <EcomdyLogo size={44} />
        </div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-danger,#ff5c7a)]">
          Acceso denegado
        </p>
        <h1 className="font-display mt-3 text-[1.75rem] font-medium tracking-tight text-[var(--auth-text)] sm:text-[2rem]">
          Tu usuario no está habilitado para el panel admin.
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--auth-text-muted)]">
          Agrega el correo a{" "}
          <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-[var(--auth-text)]">
            ADMIN_ALLOWED_EMAILS
          </code>{" "}
          o el ID a{" "}
          <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-[var(--auth-text)]">
            ADMIN_ALLOWED_USER_IDS
          </code>{" "}
          y vuelve a intentar desde el login admin de {siteConfig.name}.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href={routes.adminLogin}
            className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--auth-accent-hover)]"
          >
            Volver al login admin
          </a>
          <form action={signOutAdminAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-xl border border-white/15 bg-white/5 px-5 text-[14px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
