import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="max-w-xl p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-rose-600">Acceso denegado</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Tu usuario no está habilitado para el panel admin.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Agrega el correo a <code className="rounded bg-slate-100 px-1 font-bold">ADMIN_ALLOWED_EMAILS</code> o el ID a <code className="rounded bg-slate-100 px-1 font-bold">ADMIN_ALLOWED_USER_IDS</code> y vuelve a iniciar sesión.
        </p>
        <form action={signOutAction} className="mt-6">
          <Button type="submit" variant="secondary">Cerrar sesión</Button>
        </form>
      </Card>
    </main>
  );
}
