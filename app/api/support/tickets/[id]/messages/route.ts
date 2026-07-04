import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  listTicketMessages,
  postTicketMessage,
} from "@/services/support.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  const messages = await listTicketMessages(session, id);
  return NextResponse.json({ ok: true, messages });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { message?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Mensaje requerido." }, { status: 400 });
  }

  try {
    const message = await postTicketMessage(session, id, body.message);
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "No se pudo enviar el mensaje.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
