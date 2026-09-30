import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { setClienteModalidad } from "@/lib/ops/cliente-modalidad.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gerencia marca a un cliente como prepago o «paga después (tiene acuerdo)». */
export async function POST(request: Request) {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: "Solo gerencia." }, { status: 403 });
  }
  if (await getActingAsCliente(session.id)) {
    return NextResponse.json({ ok: false, error: "Sal de la vista de cliente." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    clienteId?: string;
    modalidad?: string;
    nota?: string;
  };
  const clienteId = String(body.clienteId ?? "").trim().toLowerCase();
  if (!UUID_RE.test(clienteId)) {
    return NextResponse.json({ ok: false, error: "Cliente inválido." }, { status: 400 });
  }
  if (body.modalidad !== "prepago" && body.modalidad !== "acuerdo") {
    return NextResponse.json({ ok: false, error: "Tipo de cliente inválido." }, { status: 400 });
  }
  const nota = String(body.nota ?? "").trim();
  if (body.modalidad === "acuerdo" && nota.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Escribe una nota: quién lo autorizó y cuándo paga." },
      { status: 400 },
    );
  }

  try {
    const entry = await setClienteModalidad({
      clienteId,
      modalidad: body.modalidad,
      nota,
      by: session.email ?? session.id,
    });
    return NextResponse.json({ ok: true, clienteId, entry });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar." },
      { status: 500 },
    );
  }
}
