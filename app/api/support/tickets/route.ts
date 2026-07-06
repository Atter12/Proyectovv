import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createSupportTicket,
  listSupportTickets,
} from "@/services/support.service";
import { notifySupportTicketCreated } from "@/lib/email/email.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const tickets = await listSupportTickets(session);
  return NextResponse.json({ ok: true, tickets });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  let body: { subject?: string; message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Mensaje requerido." }, { status: 400 });
  }

  try {
    const subject = body.subject ?? "Consulta de soporte";
    const result = await createSupportTicket(session, {
      subject,
      message: body.message,
    });

    try {
      await notifySupportTicketCreated({
        requesterEmail: session.email,
        organizationId: session.organizationId,
        userId: session.id,
        ticketId: result.ticketId,
        subject,
      });
    } catch (emailError) {
      console.error("[support] no se pudo enviar email del ticket", emailError);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el ticket.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
