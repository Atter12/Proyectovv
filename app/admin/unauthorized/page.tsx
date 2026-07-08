import { signOutAction } from "@/app/actions/auth";
import { routes } from "@/config/routes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="max-w-xl p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-rose-600">Acceso denegado</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#061925]">Tu usuario no está habilitado para el panel admin.</h1>
        <p className="mt-3 text-sm leading-6 text-[#5d7280]">
          Agrega el correo a <code className="rounded bg-[#e8f6f8] px-1 font-bold">ADMIN_ALLOWED_EMAILS</code> o el ID a <code className="rounded bg-[#e8f6f8] px-1 font-bold">ADMIN_ALLOWED_USER_IDS</code> y vuelve a intentar desde el login admin.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={routes.adminLogin}
            className="inline-flex rounded-xl border border-[#cfe1e9] bg-white px-4 py-2 text-sm font-bold text-[#16445a] transition hover:border-[#74d3b4] hover:bg-[#f2fff8]"
          >
            Volver al login admin
          </a>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">Cerrar sesión</Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
