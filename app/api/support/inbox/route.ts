import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  ensureInboxTicketForHecomCliente,
  listInboxContacts,
} from "@/lib/support/support-inbox.server";

export const runtime = "nodejs";

function assertStaff(email: string, role: string | null | undefined) {
  const funding = resolvePaymentsFundingCapabilities({ email, role });
  return funding.isStaff || funding.isSuperAdmin;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!assertStaff(session.email, session.role)) {
    return NextResponse.json(
      { error: "Solo gerentes pueden ver el inbox." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";
  const q = searchParams.get("q") ?? "";

  try {
    const tickets = await listInboxContacts({
      status,
      q,
      assignedUserId: session.id,
    });
    return NextResponse.json({
      ok: true,
      tickets,
      me: { id: session.id, email: session.email },
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "No se pudo cargar el inbox.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Abre / reutiliza chat Holistic de un cliente Hecom Club. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!assertStaff(session.email, session.role)) {
    return NextResponse.json({ error: "Solo gerentes." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      hecomClienteId?: string;
      organizationId?: string;
    };
    if (body.action !== "ensure") {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }
    if (!body.hecomClienteId) {
      return NextResponse.json(
        { error: "hecomClienteId requerido (cliente Hecom Club)." },
        { status: 400 },
      );
    }
    const ticket = await ensureInboxTicketForHecomCliente({
      session,
      hecomClienteId: body.hecomClienteId,
    });
    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "No se pudo abrir el chat.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
