import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  askProfitAdvisor,
  type ProfitAdvisorTurn,
} from "@/lib/realprofit/profit-advisor.server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE = 800;

export async function POST(request: Request) {
  const session = await requirePermission("adAccounts:read");
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return NextResponse.json(
      { error: "Solo gerencia puede usar el asesor." },
      { status: 403 },
    );
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Selecciona un cliente primero." },
      { status: 400 },
    );
  }

  let body: {
    message?: unknown;
    history?: unknown;
    from?: unknown;
    to?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Mensaje inválido." }, { status: 400 });
  }

  const history: ProfitAdvisorTurn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (row): row is ProfitAdvisorTurn =>
            !!row &&
            typeof row === "object" &&
            (row.role === "user" || row.role === "assistant") &&
            typeof row.content === "string",
        )
        .slice(-8)
    : [];

  const from = typeof body.from === "string" ? body.from.trim() : undefined;
  const to = typeof body.to === "string" ? body.to.trim() : undefined;

  try {
    const result = await askProfitAdvisor({
      hecomClienteId: selected.id,
      clienteName: selected.name,
      message,
      history,
      from,
      to,
    });
    return NextResponse.json({
      ok: true,
      reply: result.reply,
      from: result.from,
      to: result.to,
      cliente: { id: selected.id, name: selected.name },
    });
  } catch (error) {
    console.error("[profit-advisor]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar al asesor.",
      },
      { status: 500 },
    );
  }
}
