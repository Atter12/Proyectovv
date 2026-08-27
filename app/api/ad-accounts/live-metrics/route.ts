import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { assertHecomClienteAccess } from "@/lib/hecom/assert-cliente-access.server";
import { getHecomAdAccountsLiveMetrics } from "@/lib/hecom/ad-account-live.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requirePermission("adAccounts:read");
  const selected = await getSelectedHecomCliente(session.id);

  if (!selected?.id) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  try {
    await assertHecomClienteAccess(session, selected.id);
    const result = await getHecomAdAccountsLiveMetrics(selected.id, "fast");
    return NextResponse.json({
      ok: true,
      clienteId: selected.id,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar saldo en vivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
