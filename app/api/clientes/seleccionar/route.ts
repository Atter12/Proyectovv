import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import {
  isHecomOtpLoginEnabled,
  isHecomOtpStaffEmail,
  resolveHecomClientesForEmail,
  userMayAccessHecomCliente,
} from "@/lib/auth/hecom-otp.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import {
  clearSelectedHecomCliente,
  getActingAsCliente,
  getSelectedHecomCliente,
  setActingAsCliente,
  setSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";

export const dynamic = "force-dynamic";

/** GET current selected Hecom client (cookie). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const selected = await getSelectedHecomCliente(session.id);
  const actingAsCliente = await getActingAsCliente(session.id);
  return NextResponse.json({ ok: true, selected, actingAsCliente });
}

/** POST { clienteId, name? } — persist selection for dashboard scoping. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  let body: { clienteId?: string; name?: string; actAsCliente?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const isAdmin = userIsAllowedAdmin({
    id: session.id,
    email: session.email,
  });
  const isStaff = isHecomOtpStaffEmail(session.email);

  const clienteId = String(body.clienteId ?? "").trim();
  if (!clienteId && typeof body.actAsCliente === "boolean") {
    if (!isAdmin && !isStaff) {
      return NextResponse.json(
        { ok: false, error: "Solo staff puede cambiar esta vista." },
        { status: 403 },
      );
    }
    await setActingAsCliente(body.actAsCliente);
    const selected = await getSelectedHecomCliente(session.id);
    return NextResponse.json({
      ok: true,
      selected,
      actingAsCliente: body.actAsCliente,
    });
  }

  if (!clienteId) {
    return NextResponse.json(
      { ok: false, error: "Falta clienteId" },
      { status: 400 },
    );
  }

  if (isHecomOtpLoginEnabled() && !isAdmin && !isStaff) {
    const allowed = await resolveHecomClientesForEmail(session.email);
    const linkedIds = allowed.map((item) => item.id);
    if (
      !userMayAccessHecomCliente({
        isAdmin,
        isStaff,
        linkedClienteIds: linkedIds,
        clienteId,
      })
    ) {
      return NextResponse.json(
        { ok: false, error: "No tenés acceso a ese cliente." },
        { status: 403 },
      );
    }
  }

  let name = String(body.name ?? "").trim();
  try {
    const cliente = await getHecomCliente(clienteId);
    if (cliente) {
      name = name || cliente.name;
    } else if (clienteId.startsWith("otp-test:")) {
      name = name || "Cliente prueba OTP";
    } else if (!name) {
      return NextResponse.json(
        { ok: false, error: "Cliente Hecom no encontrado" },
        { status: 404 },
      );
    }
  } catch {
    if (!name) name = "Cliente Hecom";
  }

  await setSelectedHecomCliente({
    id: clienteId,
    name,
    userId: session.id,
  });
  if (typeof body.actAsCliente === "boolean") {
    if (body.actAsCliente && !isAdmin && !isStaff) {
      return NextResponse.json(
        { ok: false, error: "Solo staff puede entrar como cliente." },
        { status: 403 },
      );
    }
    await setActingAsCliente(body.actAsCliente);
  }
  const actingAsCliente = await getActingAsCliente(session.id);
  return NextResponse.json({
    ok: true,
    selected: { id: clienteId, name },
    actingAsCliente,
  });
}

/** DELETE — clear selection. */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  await clearSelectedHecomCliente();
  return NextResponse.json({ ok: true, selected: null });
}
