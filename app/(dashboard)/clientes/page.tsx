import { Suspense } from "react";
import { requireSession } from "@/lib/auth/guards.server";
import { ClientesPageClient } from "@/features/clientes/components/ClientesPageClient.client";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireSession();

  return (
    <Suspense
      fallback={
        <Card className="p-5 text-sm text-[var(--admin-text-muted,#64748b)]">
          Cargando clientes…
        </Card>
      }
    >
      <ClientesPageClient />
    </Suspense>
  );
}
