import { Suspense } from "react";
import { requireSession } from "@/lib/auth/guards.server";
import { ClientesPageClient } from "@/features/clientes/components/ClientesPageClient.client";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireSession();

  return (
    <Suspense
      fallback={
        <div className="dashboard-surface-card rounded-[1rem] p-8 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
          Cargando clientes…
        </div>
      }
    >
      <ClientesPageClient />
    </Suspense>
  );
}
