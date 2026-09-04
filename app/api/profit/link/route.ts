import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  linkStoreToCliente,
  unlinkStoreFromCliente,
} from "@/lib/realprofit/profit-snapshot.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requirePermission("adAccounts:create");
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return NextResponse.json({ error: "Solo staff." }, { status: 403 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  let body: { storeId?: string; action?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "link";
  if (!storeId) {
    return NextResponse.json({ error: "storeId requerido." }, { status: 400 });
  }

  try {
    if (action === "unlink") {
      await unlinkStoreFromCliente({
        hecomClienteId: selected.id,
        storeId,
      });
      return NextResponse.json({ ok: true, unlinked: true });
    }

    await linkStoreToCliente({
      hecomClienteId: selected.id,
      storeId,
      userId: session.id,
    });
    return NextResponse.json({ ok: true, linked: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo vincular tienda.",
      },
      { status: 400 },
    );
  }
}
