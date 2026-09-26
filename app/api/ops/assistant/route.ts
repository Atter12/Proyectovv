import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { buildAssistantResponse } from "@/lib/ops/assistant-answer";
import { loadAssistantBrief } from "@/lib/ops/assistant-brief.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return NextResponse.json({ error: "Solo gerencia." }, { status: 403 });
  }
  if (await getActingAsCliente(session.id)) {
    return NextResponse.json({ error: "Solo gerencia." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const message =
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message.trim().slice(0, 500)
      : "";
  if (!message) {
    return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  }

  try {
    const brief = await loadAssistantBrief();
    return NextResponse.json({
      ok: true,
      ...buildAssistantResponse(brief, message),
    });
  } catch (error) {
    console.error("[ops/assistant] No se pudo armar el reporte.", error);
    return NextResponse.json(
      { error: "No pude armar el reporte. Inténtalo de nuevo en unos momentos." },
      { status: 500 },
    );
  }
}
