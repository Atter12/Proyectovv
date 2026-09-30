import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { buildAssistantResponse } from "@/lib/ops/assistant-answer";
import { loadAssistantBrief } from "@/lib/ops/assistant-brief.server";
import { answerWithLlm, isAssistantLlmEnabled, type AssistantTurn } from "@/lib/ops/assistant-llm.server";

export const runtime = "nodejs";
// La IA consulta varias herramientas (Hecom + Ads Holistic); suele tardar 3–10 s.
export const maxDuration = 60;

function parseHistory(body: unknown): AssistantTurn[] {
  if (!body || typeof body !== "object" || !("history" in body) || !Array.isArray(body.history)) return [];
  return body.history
    .filter((t): t is { q: string; a: string } => Boolean(t) && typeof t.q === "string" && typeof t.a === "string")
    .slice(-4)
    .map((t) => ({ q: t.q.slice(0, 500), a: t.a.slice(0, 1500) }));
}

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

  if (isAssistantLlmEnabled()) {
    try {
      return NextResponse.json({ ok: true, ...(await answerWithLlm(message, parseHistory(body))) });
    } catch (error) {
      // Si la IA falla, responde el asistente de reglas con el mismo corte de datos.
      console.error("[ops/assistant] IA falló, uso respaldo.", error);
    }
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
