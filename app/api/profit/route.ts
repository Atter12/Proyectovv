import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { defaultProfitDateRange } from "@/lib/realprofit/db.server";
import { loadClienteProfitPromo } from "@/lib/realprofit/profit-snapshot.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requirePermission("adAccounts:read");
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const range = defaultProfitDateRange();
  const from = url.searchParams.get("from")?.trim() || range.from;
  const to = url.searchParams.get("to")?.trim() || range.to;

  try {
    const data = await loadClienteProfitPromo({
      hecomClienteId: selected.id,
      from,
      to,
    });
    return NextResponse.json({
      ok: true,
      cliente: { id: selected.id, name: selected.name },
      from,
      to,
      realProfitUrl:
        process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() ||
        "https://www.realprofitcod.com",
      ...data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo cargar profit.",
      },
      { status: 500 },
    );
  }
}
