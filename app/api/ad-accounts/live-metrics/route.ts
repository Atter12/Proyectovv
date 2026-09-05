import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { assertHecomClienteAccess } from "@/lib/hecom/assert-cliente-access.server";
import { getHecomAdAccountsLiveMetrics } from "@/lib/hecom/ad-account-live.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    const fresh =
      new URL(request.url).searchParams.get("fresh") === "1" ||
      new URL(request.url).searchParams.get("fresh") === "true";
    const result = await getHecomAdAccountsLiveMetrics(selected.id, "fast", {
      bypassCache: fresh,
    });
    return NextResponse.json({
      ok: true,
      clienteId: selected.id,
      cached: !fresh,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar saldo en vivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
