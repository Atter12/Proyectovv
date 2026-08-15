import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  claimInboxTicket,
  releaseInboxTicket,
} from "@/lib/support/support-inbox.server";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function assertStaff(email: string, role: string | null | undefined) {
  const funding = resolvePaymentsFundingCapabilities({ email, role });
  return funding.isStaff || funding.isSuperAdmin;
}

/** POST { action: "claim" | "release" } — estilo Whaticket tomar/liberar chat. */
export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!assertStaff(session.email, session.role)) {
    return NextResponse.json({ error: "Solo gerentes." }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    if (body.action === "claim") {
      const ticket = await claimInboxTicket({ session, ticketId: id });
      return NextResponse.json({ ok: true, ticket });
    }
    if (body.action === "release") {
      await releaseInboxTicket({ session, ticketId: id });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "Acción inválida. Usá claim o release." },
      { status: 400 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "No se pudo actualizar.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
