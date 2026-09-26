import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { answerAssistant } from "@/lib/ops/assistant-answer";
import { loadAssistantBrief } from "@/lib/ops/assistant-brief.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const funding = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return NextResponse.json({ error: "Solo gerencia." }, { status: 403 });
  }

  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const message = String(body.message || "").trim().slice(0, 500);
  if (!message) {
    return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  }

  try {
    const brief = await loadAssistantBrief();
    return NextResponse.json({
      ok: true,
      reply: answerAssistant(brief, message),
      today: brief.today,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No pude leer Hecom.";
    return NextResponse.json(
      { error: `No pude armar el reporte. ${detail}` },
      { status: 500 },
    );
  }
}
