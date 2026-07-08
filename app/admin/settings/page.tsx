import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KpiCard } from "@/components/admin/KpiCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/admin/auth";
import { serverEnv } from "@/lib/env/env.server";

export const dynamic = "force-dynamic";

function masked(value: string): string {
  if (!value) return "No configurado";
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export default async function SettingsPage() {
  const admin = await requireAdmin();
  return (
    <>
      <AdminPageHeader eyebrow="Sistema" title="Configuración del panel" description="Estado de variables y modelo de acceso del repo admin. No se muestran secretos completos." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ambiente" value={serverEnv.appEnv} detail={serverEnv.isProduction ? "Modo producción" : "Modo desarrollo"} accent="slate" />
        <KpiCard label="Allowlist emails" value={String(serverEnv.adminAllowedEmails.length)} detail={admin.accessMode} accent="indigo" />
        <KpiCard label="Allowlist IDs" value={String(serverEnv.adminAllowedUserIds.length)} detail="Usuarios permitidos" accent="indigo" />
        <KpiCard label="Service role" value={serverEnv.supabaseServiceRoleKey ? "OK" : "Falta"} detail="Solo server-side" accent={serverEnv.supabaseServiceRoleKey ? "emerald" : "rose"} />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-black text-slate-950">Variables principales</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">App URL</dt><dd className="mt-1 font-bold text-slate-800">{serverEnv.appUrl}</dd></div>
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Customer app</dt><dd className="mt-1 font-bold text-slate-800">{serverEnv.customerAppUrl}</dd></div>
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Supabase URL</dt><dd className="mt-1 font-bold text-slate-800">{serverEnv.supabaseUrl || "No configurado"}</dd></div>
          <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Service role</dt><dd className="mt-1 font-bold text-slate-800">{masked(serverEnv.supabaseServiceRoleKey)}</dd></div>
        </dl>
      </Card>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-black text-slate-950">Admin actual</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone="success">{admin.email}</Badge><Badge tone={admin.accessMode === "development-open" ? "warning" : "purple"}>{admin.accessMode}</Badge></div>
      </Card>
    </>
  );
}
